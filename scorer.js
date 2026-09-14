//Scoring engine using dimension, method, params, and weight columns
function scoreInverseCostValue(value, method, params) {
	const cost = Number(value);
	if (!Number.isFinite(cost) || cost < 0) return null;
	let minimum = Number(params.base);
	let maximum = Number(params.max);
	if (!Number.isFinite(maximum) && Number.isFinite(minimum) && Number(params.range) > 1) {
		maximum = minimum * Number(params.range);
	}
	if (params.source) {
		const source = Array.isArray(window[params.source]) ? window[params.source] : [];
		const field = params.field || 'price';
		const prices = source.map(item => Number(item[field])).filter(price => Number.isFinite(price) && price > 0);
		if (!prices.length) return null;
		minimum = Math.min(...prices);
		maximum = Math.max(...prices);
	}
	if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum || cost <= minimum) return 100;
	if (cost >= maximum) return 0;
	const denominator = method === 'inverse_linear'
		? maximum - minimum
		: Math.log(maximum / minimum);
	const position = method === 'inverse_linear'
		? (cost - minimum) / denominator
		: Math.log(cost / minimum) / denominator;
	return Math.max(0, Math.min(100, 100 * (1 - position)));
}

function scoreCustomQuestionValue(value, method, params) {
	if (method === 'inverse_rating') {
		const cost = Number(value);
		if (!Number.isFinite(cost) || cost < 0) return null;
		let rating;
		if (params.kind === 'linear') {
			rating = 1 + Number(params.slope) * (cost - Number(params.base));
		} else if (params.kind === 'log1p') {
			rating = 1 + 9 * Math.log1p(cost) / Math.log(Number(params.range));
		} else if (params.kind === 'log_ratio') {
			rating = cost <= Number(params.base)
			? 1
			: 1 + 9 * Math.log(cost / Number(params.base)) / Math.log(Number(params.range));
		} else {
			return null;
		}
		if (!Number.isFinite(rating)) return null;
		rating = Math.max(1, Math.min(10, rating));
		return 100 * (10 - rating) / 9;
	}
	if (method !== 'inverse_log' && method !== 'inverse_linear') return null;
	return scoreInverseCostValue(value, method, params);
}

function calculateScores(QUESTION_AREAS, ANSWERS, analysisMode = 'advanced') {
	function getQuestionWeight(q) {
		const modeKey = analysisMode === 'routine' ? 'weight_routine' : 'weight_advanced';
		const modeWeight = parseFloat(q[modeKey]);
		if (!isNaN(modeWeight)) return modeWeight;
		const weight = parseFloat(q.weight);
		return isNaN(weight) ? 1 : weight;
	}
	const dimScores = {};
	const dimWeights = {};
	const contributions = {}; // per-dimension list of question contributions for debugging
	const scoringAudit = [];
	for (const area of QUESTION_AREAS) {
		for (const q of area.questions) {
			const dim = q.dimension;
			if (!dim) continue;
			let score = null;
			let ruleDetail = null;
			const weight = getQuestionWeight(q);
			const val = ANSWERS[q.id];
			const audit = {
				section: area.title,
				id: q.id,
				question: q.text,
				method: q.method || '',
				rawAnswer: val,
				weight: weight,
				weightColumn: analysisMode === 'routine' ? 'weight_routine' : 'weight_advanced',
				status: 'not scored'
			};
			audit.activeRanges = null;
			if (!q.method || !q.params) {
				audit.status = 'missing method or parameters';
				scoringAudit.push(audit);
				continue;
			}
			let params;
			try {
				params = typeof q.params === 'object' ? q.params : JSON.parse(q.params);
			} catch (e) {
				console.warn('Malformed params for question', q.id, q.params);
				audit.status = 'malformed parameters';
				scoringAudit.push(audit);
				continue;
			}
			const customScore = scoreCustomQuestionValue(val, q.method, params);
			if (customScore !== null) {
				score = customScore;
				ruleDetail = { type: q.method, params, input: Number(val), output: score };
			} else if (q.method === 'threshold' && (q.type === 'number' || q.type === 'chem_lookup' || q.type === 'column_selector' || q.type === 'equipment_dropdown' || q.type === 'equipment_checklist')) {
				const activeRanges = Array.isArray(params.ranges)
					? params.ranges
					: params[analysisMode] && Array.isArray(params[analysisMode].ranges)
						? params[analysisMode].ranges
						: null;
				if (!activeRanges) {
					console.warn('Missing or invalid ranges for threshold question', q.id);
					audit.status = 'invalid rule';
					scoringAudit.push(audit);
					continue;
				}
				const num = parseFloat(val);
				if (isNaN(num)) {
					audit.status = 'unanswered or non-numeric';
					scoringAudit.push(audit);
					continue;
				}
				const validRanges = activeRanges
					.filter(range => typeof range.max === 'number' && typeof range.score === 'number')
					.sort((a, b) => a.max - b.max);
				const best = validRanges.find(range => num <= range.max) || null;
				if (best) {
					score = best.score;
					ruleDetail = { type: 'threshold', matchedRange: best };
					audit.activeRanges = activeRanges;
				} else {
					score = 0;
					ruleDetail = { type: 'threshold', matchedRange: null };
					audit.activeRanges = activeRanges;
				}
			} else if (q.method === 'lookup' && (q.type === 'dropdown' || q.type === 'boolean')) {
				if (!params || typeof params !== 'object') {
					console.warn('Missing or invalid params for lookup question', q.id);
					audit.status = 'invalid rule';
					scoringAudit.push(audit);
					continue;
				}
				if (val === undefined || val === null || val === '') {
					audit.status = 'unanswered';
					scoringAudit.push(audit);
					continue;
				}
				if (val in params) {
					score = params[val];
					ruleDetail = { type: 'lookup', matchedKey: val, mappedValue: params[val] };
				} else {
					console.warn('No lookup match for', val, 'in', q.id);
					score = 0;
					ruleDetail = { type: 'lookup', matchedKey: val, mappedValue: null };
				}
			} else if (q.method === 'formula' && q.type === 'number') {
				if (!params.expr || typeof params.expr !== 'string') {
					console.warn('Missing or invalid expr for formula question', q.id);
					audit.status = 'invalid rule';
					scoringAudit.push(audit);
					continue;
				}
				const num = parseFloat(val);
				if (isNaN(num)) {
					audit.status = 'unanswered or non-numeric';
					scoringAudit.push(audit);
					continue;
				}
				try {
					const expr = params.expr.replace(/value/g, '(' + num + ')');
					score = Function('return ' + expr)();
					ruleDetail = { type: 'formula', expr: params.expr, evaluatedWith: num };
				} catch (e) {
					console.warn('Error evaluating formula for', q.id, params.expr);
					score = 0;
					ruleDetail = { type: 'formula', expr: params.expr, error: e && e.message };
				}
				if (typeof score !== 'number' || isNaN(score)) score = 0;
				if (score < 0) score = 0;
				if (score > 100) score = 100;
			}
			if (score !== null && typeof score === 'number' && !isNaN(score)) {
				if (!dimScores[dim]) { dimScores[dim] = 0; dimWeights[dim] = 0; }
				dimScores[dim] += score * weight;
				dimWeights[dim] += weight;
				// compute points on a 0-4 scale per question and weightedPoints using weight
				const points = (score / 100) * 4;
				const weightedPoints = points * weight;
				if (!contributions[dim]) contributions[dim] = [];
				contributions[dim].push({ id: q.id, text: q.text, rawAnswer: val, score: score, weight: weight, weighted: score * weight, points: points, weightedPoints: weightedPoints, ruleDetail });
				audit.score = score;
				audit.points = points;
				audit.weightedScore = score * weight;
				audit.weightedPoints = weightedPoints;
				audit.rule = ruleDetail;
				audit.status = 'scored';
			}
			scoringAudit.push(audit);
		}
	}
	// Derive final judging categories dynamically from QUESTION_AREAS
	const allDims = Array.isArray(QUESTION_AREAS) ? QUESTION_AREAS.map(a => a.title) : Object.keys(dimWeights);
	const result = {};
	for (const dim of allDims) {
		if (dimWeights[dim] > 0) {
			let v = dimScores[dim] / dimWeights[dim];
			if (v < 0) v = 0;
			if (v > 100) v = 100;
			result[dim] = Math.round(v);
		} else {
			result[dim] = 0;
		}
	}

	// Build normalized (precise) scores map based on 0-4 points per question
	const normalizedScores = {};
	const sectionPoints = {}; // holds totalWeightedPoints and sectionMaxPoints per dim
	for (const dim of allDims) {
		const list = contributions[dim] || [];
		const totalWeightedPoints = list.reduce((s, it) => s + (it.weightedPoints || 0), 0);
		const sectionMaxPoints = (dimWeights[dim] || 0) * 4; // 4 points per weight unit
		const normalizedPercent = sectionMaxPoints > 0 ? (totalWeightedPoints / sectionMaxPoints) * 100 : 0;
		normalizedScores[dim] = normalizedPercent;
		sectionPoints[dim] = { totalWeightedPoints, sectionMaxPoints };
	}

	// Use normalizedScores (from 0-100) as the final rounded result
	for (const dim of allDims) {
		result[dim] = Math.round(normalizedScores[dim] || 0);
	}

	// Debug output: structured per-dimension breakdown with exact per-answer scores
	try {
		console.groupCollapsed && console.groupCollapsed('calculateScores — detailed debug');
		console.log('Scoring configuration:', {
			analysisMode,
			questionCount: scoringAudit.length,
			scoredQuestionCount: scoringAudit.filter(item => item.status === 'scored').length,
			skippedQuestionCount: scoringAudit.filter(item => item.status !== 'scored').length
		});
		console.table(scoringAudit.map(item => ({
			section: item.section,
			id: item.id,
			method: item.method,
			status: item.status,
			rawAnswer: item.rawAnswer,
			weight: item.weight,
			weightColumn: item.weightColumn,
			score: item.score === undefined ? '' : Number(item.score.toFixed(4)),
			weightedScore: item.weightedScore === undefined ? '' : Number(item.weightedScore.toFixed(4)),
			activeRanges: item.activeRanges ? JSON.stringify(item.activeRanges) : '',
			rule: item.rule ? JSON.stringify(item.rule) : ''
		})));
		console.log('Normalized section scores:', Object.fromEntries(Object.entries(normalizedScores).map(([k,v])=>[k, Number(v.toFixed(4))])));
		console.log('Raw weighted totals:', dimScores);
		console.log('Total weights:', dimWeights);
		for (const dim of allDims) {
			const preciseScoreAvg = (dimWeights[dim] > 0) ? ( (dimScores[dim] || 0) / dimWeights[dim] ) : 0;
			const normalized = normalizedScores[dim] || 0;
			console.group && console.group(dim + ' — final (rounded): ' + result[dim] + ' — precise average: ' + preciseScoreAvg.toFixed(2) + ' — normalized: ' + normalized.toFixed(2) + '%');
			const list = contributions[dim] || [];
			if (list.length) {
				console.table(list.map(it => {
					const contributionToSection = (dimWeights[dim] > 0) ? (it.weighted / dimWeights[dim]) : 0;
					return {
						id: it.id,
						question: it.text,
						answer: it.rawAnswer,
						exactScore: Number((it.score).toFixed(4)),
						points: Number((it.points || 0).toFixed(4)),
						weight: it.weight,
						weightedPoints: Number((it.weightedPoints || 0).toFixed(4)),
						weighted: Number((it.weighted).toFixed(4)),
						contributionToSection: Number((contributionToSection).toFixed(4)),
						rule: JSON.stringify(it.ruleDetail)
					};
				}));
				// Human-readable per-question lines for quick verification
				for (const it of list) {
					const exact = Number(it.score).toFixed(2);
					const pts = Number((it.points || 0).toFixed(2));
					let ruleDesc = '';
					const rd = it.ruleDetail;
					if (rd) {
						if (rd.type === 'threshold') {
							if (rd.matchedRange) ruleDesc = `(threshold: <= ${rd.matchedRange.max} → ${rd.matchedRange.score})`;
							else ruleDesc = `(threshold: no match → 0)`;
						} else if (rd.type === 'inverse_log' || rd.type === 'inverse_linear' || rd.type === 'inverse_rating') {
							ruleDesc = `(${rd.type}: inverse cost, normalized 0–100)`;
						} else if (rd.type === 'lookup') {
							ruleDesc = `(lookup: ${rd.matchedKey} → ${String(rd.mappedValue)})`;
						} else if (rd.type === 'formula') {
							if (rd.error) ruleDesc = `(formula error: ${rd.error})`;
							else ruleDesc = `(formula: ${rd.expr} with value ${rd.evaluatedWith})`;
						}
					}
					console.log(`${it.id}: answered "${it.rawAnswer}" → ${exact}/100 → ${pts}/4 ${ruleDesc}`);
				}
			} else {
				console.log('(no contributing questions for this category)');
			}
			const sp = sectionPoints[dim] || { totalWeightedPoints: 0, sectionMaxPoints: 0 };
			console.log('section points:', sp.totalWeightedPoints.toFixed(4), '/', sp.sectionMaxPoints.toFixed(4), '(' + (sp.sectionMaxPoints>0 ? ( (sp.totalWeightedPoints/sp.sectionMaxPoints*100).toFixed(2) + '%' ) : '0%') + ')');
			console.log('weighted total (raw 0-100):', dimScores[dim] || 0, 'total weight:', dimWeights[dim] || 0);
			console.log('category aggregation:', {
				category: dim,
				weightedScoreTotal: Number((dimScores[dim] || 0).toFixed(4)),
				weightTotal: Number((dimWeights[dim] || 0).toFixed(4)),
				finalScore: result[dim]
			});
			console.groupEnd && console.groupEnd();
		}
		console.groupEnd && console.groupEnd();
	} catch (e) {
		// ignore logging errors
	}
	return result;
}

// Export for browser global
window.calculateScores = calculateScores;
window.scoreCustomQuestionValue = scoreCustomQuestionValue;
