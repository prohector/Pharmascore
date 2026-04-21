//Scoring engine using dimension, method, params, and weight columns
function calculateScores(QUESTION_AREAS, ANSWERS) {
	const dimScores = {};
	const dimWeights = {};
	for (const area of QUESTION_AREAS) {
		for (const q of area.questions) {
			const dim = q.dimension;
			if (!dim) continue;
			let score = null;
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
						break;
					}
				}
				if (score === null) score = 0;
			} else if (q.method === 'lookup' && (q.type === 'dropdown' || q.type === 'boolean')) {
				if (!params || typeof params !== 'object') {
					console.warn('Missing or invalid params for lookup question', q.id);
					continue;
				}
				if (val in params) {
					score = params[val];
				} else {
					console.warn('No lookup match for', val, 'in', q.id);
					score = 0;
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
				} catch (e) {
					console.warn('Error evaluating formula for', q.id, params.expr);
					score = 0;
				}
				if (typeof score !== 'number' || isNaN(score)) score = 0;
				if (score < 0) score = 0;
				if (score > 100) score = 100;
			}
			if (score !== null && typeof score === 'number' && !isNaN(score)) {
				if (!dimScores[dim]) { dimScores[dim] = 0; dimWeights[dim] = 0; }
				dimScores[dim] += score * weight;
				dimWeights[dim] += weight;
			}
		}
	}
	const allDims = ['Sustainability', 'Cost', 'Safety', 'Efficiency'];
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
	return result;
}

// Export for browser global
window.calculateScores = calculateScores;
