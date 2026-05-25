//Scoring engine using dimension, method, params, and weight columns
function calculateScores(QUESTION_AREAS, ANSWERS) {
	const dimScores = {};
	const dimWeights = {};
	const contributions = {}; // per-dimension list of question contributions for debugging
	for (const area of QUESTION_AREAS) {
		for (const q of area.questions) {
			const dim = q.dimension;
			if (!dim) continue;
			let score = null;
			let ruleDetail = null;
			let weight = parseFloat(q.weight);
			if (isNaN(weight)) weight = 1;
			if (!q.method || !q.params) continue;
			let params;
			try {
				params = typeof q.params === 'object' ? q.params : JSON.parse(q.params);
			} catch (e) {
				console.warn('Malformed params for question', q.id, q.params);
				continue;
			}
			const val = ANSWERS[q.id];
			if (q.method === 'threshold' && (q.type === 'number' || q.type === 'chem_lookup')) {
				if (!params.ranges || !Array.isArray(params.ranges)) {
					console.warn('Missing or invalid ranges for threshold question', q.id);
					continue;
				}
				const num = parseFloat(val);
				if (isNaN(num)) continue;
				for (const r of params.ranges) {
					if (typeof r.max !== 'number' || typeof r.score !== 'number') continue;
					if (num <= r.max) {
						score = r.score;
						ruleDetail = { type: 'threshold', matchedRange: r };
						break;
					}
				}
				if (score === null) { score = 0; ruleDetail = { type: 'threshold', matchedRange: null }; }
			} else if (q.method === 'lookup' && (q.type === 'dropdown' || q.type === 'boolean')) {
				if (!params || typeof params !== 'object') {
					console.warn('Missing or invalid params for lookup question', q.id);
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
					continue;
				}
				const num = parseFloat(val);
				if (isNaN(num)) continue;
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
				if (!contributions[dim]) contributions[dim] = [];
				contributions[dim].push({ id: q.id, text: q.text, rawAnswer: val, score: score, weight: weight, weighted: score * weight, ruleDetail });
			}
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

	// Build normalized (precise) scores map and output debug info
	const normalizedScores = {};
	for (const dim of allDims) {
		normalizedScores[dim] = (dimWeights[dim] > 0) ? ((dimScores[dim] || 0) / dimWeights[dim]) : 0;
	}

	// Debug output: structured per-dimension breakdown with exact per-answer scores
	try {
		console.groupCollapsed && console.groupCollapsed('calculateScores — detailed debug');
		console.log('Normalized section scores:', Object.fromEntries(Object.entries(normalizedScores).map(([k,v])=>[k, Number(v.toFixed(4))])));
		console.log('Raw weighted totals:', dimScores);
		console.log('Total weights:', dimWeights);
		for (const dim of allDims) {
			const precise = (dimWeights[dim] > 0) ? ( (dimScores[dim] || 0) / dimWeights[dim] ) : 0;
			console.group && console.group(dim + ' — final (rounded): ' + result[dim] + ' — precise: ' + precise.toFixed(2));
			const list = contributions[dim] || [];
			if (list.length) {
				console.table(list.map(it => {
					const contributionToSection = (dimWeights[dim] > 0) ? (it.weighted / dimWeights[dim]) : 0;
					return {
						id: it.id,
						question: it.text,
						answer: it.rawAnswer,
						exactScore: Number((it.score).toFixed(4)),
						weight: it.weight,
						weighted: Number((it.weighted).toFixed(4)),
						contributionToSection: Number((contributionToSection).toFixed(4))
						,rule: JSON.stringify(it.ruleDetail)
					};
				}));
				// Human-readable per-question lines for quick verification
				for (const it of list) {
					const exact = Number(it.score).toFixed(2);
					let ruleDesc = '';
					const rd = it.ruleDetail;
					if (rd) {
						if (rd.type === 'threshold') {
							if (rd.matchedRange) ruleDesc = `(threshold: <= ${rd.matchedRange.max} → ${rd.matchedRange.score})`;
							else ruleDesc = `(threshold: no match → 0)`;
						} else if (rd.type === 'lookup') {
							ruleDesc = `(lookup: ${rd.matchedKey} → ${String(rd.mappedValue)})`;
						} else if (rd.type === 'formula') {
							if (rd.error) ruleDesc = `(formula error: ${rd.error})`;
							else ruleDesc = `(formula: ${rd.expr} with value ${rd.evaluatedWith})`;
						}
					}
					console.log(`${it.id}: answered "${it.rawAnswer}" → ${exact}/100 ${ruleDesc}`);
				}
			} else {
				console.log('(no contributing questions for this category)');
			}
			console.log('weighted total:', dimScores[dim] || 0, 'total weight:', dimWeights[dim] || 0);
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
