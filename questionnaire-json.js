(function () {
  const FORMAT_VERSION = 2;

  function parseJsonInput(input) {
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch {
        throw new Error('Questionnaire JSON is not valid JSON.');
      }
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Questionnaire JSON must be an object.');
    }
    return input;
  }

  function getAvailableAnswers(question) {
    if (!question) return [];
    if (Array.isArray(question.options)) return question.options.map(String);
    if (typeof question.options === 'string') return question.options.split(';').map(item => item.trim()).filter(Boolean);

    if (question.type === 'csv_dropdown') {
      const params = typeof question.params === 'string' ? (() => {
        try { return JSON.parse(question.params); } catch { return {}; }
      })() : (question.params || {});
      const source = Array.isArray(window[params.source || 'SAMPLE_ANALYSIS_RESULTS_OPTIONS'])
        ? window[params.source || 'SAMPLE_ANALYSIS_RESULTS_OPTIONS']
        : [];
      return source.map(item => String(item[params.valueField || 'value'] ?? item.value ?? item.name ?? '')).filter(Boolean);
    }

    if (question.type === 'equipment_dropdown') {
      return {
        categories: (Array.isArray(window.INSTRUMENT_OPTIONS) ? [...new Set(window.INSTRUMENT_OPTIONS.map(item => String(item.type || '')).filter(Boolean))] : []).concat('Other'),
        names: Array.isArray(window.INSTRUMENT_OPTIONS) ? window.INSTRUMENT_OPTIONS.map(item => ({ category: item.type || '', name: item.name || '', price: Number(item.price || 0) })).filter(item => item.name) : []
      };
    }
    if (question.type === 'column_selector') {
      return {
        categories: (Array.isArray(window.COLUMN_OPTIONS) ? [...new Set(window.COLUMN_OPTIONS.map(item => String(item.type || '')).filter(Boolean))] : []).concat('Other'),
        names: Array.isArray(window.COLUMN_OPTIONS) ? window.COLUMN_OPTIONS.map(item => ({ category: item.type || '', name: item.fullName || '', price: Number(item.price || 0) })).filter(item => item.name) : []
      };
    }
    if (question.type === 'equipment_checklist') {
      return (typeof window.getAuxiliaryEquipmentOptions === 'function'
        ? window.getAuxiliaryEquipmentOptions(question.id).map(item => String(item.name || '')).filter(Boolean)
        : []).concat('Add other');
    }
    if (question.type === 'recurring_cost_calculator') {
      const solventNames = (Array.isArray(window.SOLVENT_OPTIONS) ? window.SOLVENT_OPTIONS : []).map(item => String(item.name || '')).filter(Boolean);
      const bufferNames = (Array.isArray(window.BUFFER_OPTIONS) ? window.BUFFER_OPTIONS : []).map(item => String(item.name || '')).filter(Boolean);
      return {
        normalPhaseSolvents: solventNames.concat('Other'),
        reversePhaseSolvents: solventNames.concat('Other'),
        buffers: bufferNames.concat('Other'),
        modifiers: bufferNames.concat('Other')
      };
    }
    return [];
  }

  function getQuestionExportValue(question) {
    const id = question.id;
    if (question.type === 'equipment_dropdown') {
      const name = window.ANSWERS[id + '_name'];
      const type = window.ANSWERS[id + '_type'];
      if (!name) return null;
      return { category: type === '__other__' ? 'Other' : (type || 'Other'), name, price: window.ANSWERS[id] !== undefined ? window.ANSWERS[id] : undefined };
    }
    if (question.type === 'column_selector') {
      const name = window.ANSWERS[id + '_name'];
      const type = window.ANSWERS[id + '_type'];
      if (!name) return null;
      return { category: type === '__other__' ? 'Other' : (type || 'Other'), name, price: window.ANSWERS[id] !== undefined ? window.ANSWERS[id] : undefined };
    }
    if (question.type === 'equipment_checklist') {
      let items = [];
      let custom = [];
      try { items = window.ANSWERS[id + '_items'] ? JSON.parse(window.ANSWERS[id + '_items']) : []; } catch { items = []; }
      try { custom = window.ANSWERS[id + '_other_items'] ? JSON.parse(window.ANSWERS[id + '_other_items']) : []; } catch { custom = []; }
      return items.concat(custom.filter(entry => entry && entry.name && !items.some(item => String((item && item.name) || item || '').toLowerCase() === String(entry.name).toLowerCase())));
    }
    if (question.type === 'recurring_cost_calculator') {
      const mix = window.RECURRING_MIXES && window.RECURRING_MIXES[id];
      if (!mix) return null;
      return {
        run: window.ANSWERS[id + '_run'] || '',
        flow: window.ANSWERS[id + '_flow'] || '',
        gradientFlow: window.ANSWERS[id + '_gradient_flow'] || '',
        gradientMode: mix.gradientMode || 'isocratic',
        normalPhaseSolvents: mix.normalPhaseSolvents || [],
        reversePhaseSolvents: mix.reversePhaseSolvents || [],
        buffers: mix.buffers || [],
        modifiers: mix.modifiers || [],
        gradientRows: mix.gradientRows || [],
        total: window.ANSWERS[id] || ''
      };
    }
    return window.ANSWERS[id] ?? null;
  }

  function buildQuestionnaireJson() {
    if (!Array.isArray(window.QUESTION_AREAS) || !window.QUESTION_AREAS.length) {
      throw new Error('The questionnaire has not loaded yet.');
    }
    if (typeof window.saveCurrentTabAnswers === 'function') window.saveCurrentTabAnswers();

    const questions = [];
    window.QUESTION_AREAS.forEach(area => {
      (area.questions || []).forEach(question => {
        const answerFormat = question.type === 'equipment_dropdown' || question.type === 'column_selector'
          ? '{ category, name, price? }'
          : question.type === 'equipment_checklist'
            ? '[string] or [{ name, amount, price? }]'
            : question.type === 'recurring_cost_calculator'
              ? '{ run, flow, gradientMode, gradientFlow?, normalPhaseSolvents: [{name,percent,price}], reversePhaseSolvents: [...], buffers: [{name,amountMgPerL,price}], modifiers: [...], gradientRows: [{time,values:{A,B}}] }'
              : 'single value';
        questions.push({
          section: area.title,
          id: question.id,
          text: question.text || question.id,
          type: question.type,
          unit: question.unit || '',
          required: Boolean(question.required),
          helpText: question.help_text || '',
          availableAnswers: getAvailableAnswers(question),
          answerFormat,
          value: getQuestionExportValue(question)
        });
      });
    });

    return {
      format: 'PharmaScore questionnaire',
      version: FORMAT_VERSION,
      generatedAt: new Date().toISOString(),
      analysisMode: window.ANALYSIS_MODE || null,
      questions,
      answers: { ...window.ANSWERS },
      recurringMixes: JSON.parse(JSON.stringify(window.RECURRING_MIXES || {}))
    };
  }

  function importQuestionnaireJson(input) {
    const document = parseJsonInput(input);
    if (document.format && document.format !== 'PharmaScore questionnaire') {
      throw new Error('This JSON is not a PharmaScore questionnaire document.');
    }
    const sourceAnswers = document.answers && typeof document.answers === 'object' && !Array.isArray(document.answers)
      ? document.answers
      : Array.isArray(document.questions)
        ? Object.fromEntries(document.questions.filter(question => question && question.id && question.value !== undefined).map(question => [question.id, question.value]))
        : null;
    if (!sourceAnswers) {
      throw new Error('Questionnaire JSON must contain an answers object.');
    }

    const knownIds = new Set((window.QUESTION_AREAS || []).flatMap(area => (area.questions || []).map(question => question.id)));
    const importedAnswers = {};
    Object.entries(sourceAnswers).forEach(([key, value]) => {
      const questionId = key.replace(/_(items|total|name|type|run|flow|gradient_flow|gradient_mode|normal_phase_solvent_entries|reverse_phase_solvent_entries|solvent_entries|buffer_entries|modifier_entries|gradient_rows|price|grams|link)$/, '');
      if (knownIds.has(questionId) || key.includes('_')) importedAnswers[key] = value;
    });

    normalizeStructuredAnswers(importedAnswers);

    window.ANSWERS = importedAnswers;
    window.RECURRING_MIXES = document.recurringMixes && typeof document.recurringMixes === 'object'
      ? document.recurringMixes
      : {};
    if (document.analysisMode === 'routine' || document.analysisMode === 'advanced') {
      window.ANALYSIS_MODE = document.analysisMode;
    }

    const requiredIds = (window.QUESTION_AREAS || []).flatMap(area => (area.questions || [])
      .filter(question => question && question.type !== 'label' && question.required)
      .map(question => question.id));
    const answered = new Set(Object.keys(importedAnswers).map(key => key.replace(/_(items|total|name|type|run|flow|gradient_flow|gradient_mode|normal_phase_solvent_entries|reverse_phase_solvent_entries|solvent_entries|buffer_entries|modifier_entries|gradient_rows|price|grams|link)$/, '')));
    const unfilled = requiredIds.filter(id => !answered.has(id));

    if (typeof window.renderQuestions === 'function') window.renderQuestions();
    if (typeof window.restoreCurrentTabAnswers === 'function') window.restoreCurrentTabAnswers();
    if (typeof window.updateSectionTitle === 'function') window.updateSectionTitle();
    if (typeof window.updateProgress === 'function') window.updateProgress();
    if (typeof window.updateNavButtons === 'function') window.updateNavButtons();
    if (typeof window.checkFormValidity === 'function') window.checkFormValidity();
    if (typeof window.updateCurrentSectionScore === 'function') window.updateCurrentSectionScore();
    if (typeof window.autoFillMissingOtherPrices === 'function') window.autoFillMissingOtherPrices();
    return buildQuestionnaireJson();
  }

  function normalizeStructuredAnswers(answers) {
    const questions = (window.QUESTION_AREAS || []).flatMap(area => area.questions || []);
    questions.forEach(question => {
      const value = answers[question.id];
      if (value === undefined || value === null) return;
      if ((question.type === 'dropdown' || question.type === 'csv_dropdown') && typeof value === 'string') {
        const available = getAvailableAnswers(question).filter(item => typeof item === 'string');
        const matched = findBestLabel(available, value);
        answers[question.id] = matched || value;
        return;
      }
      if (question.type === 'boolean' && (value === true || value === false)) {
        answers[question.id] = value ? 'true' : 'false';
        return;
      }
      if (question.type === 'equipment_dropdown' && value && typeof value === 'object') {
        const ids = window.getEquipmentDropdownIds(question.id);
        const name = String(value.name || value.instrument || '').trim();
        const referencePrice = Number(value.price);
        const match = findBestOption(window.INSTRUMENT_OPTIONS || [], name, 'name', referencePrice);
        let selectedCategory;
        let selectedName;
        if (match) {
          selectedCategory = String(match.type || '');
          selectedName = String(match.name || '');
        } else if (name) {
          selectedCategory = '__other__';
          selectedName = name;
        } else {
          delete answers[question.id];
          return;
        }
        answers[ids.typeId] = selectedCategory;
        answers[ids.nameId] = selectedName;
        answers[question.id + '_type'] = selectedCategory;
        answers[question.id + '_name'] = selectedName;
        const otherPrice = value.price !== undefined && selectedCategory === '__other__' ? String(value.price) : null;
        delete answers[question.id];
        if (otherPrice !== null) answers[question.id] = otherPrice;
        return;
      }
      if (question.type === 'equipment_dropdown' && typeof value === 'string') {
        const ids = window.getEquipmentDropdownIds(question.id);
        const name = value.trim();
        const match = findBestOption(window.INSTRUMENT_OPTIONS || [], name, 'name');
        const selectedName = match ? String(match.name) : name;
        answers[ids.typeId] = match ? String(match.type || '') : '__other__';
        answers[ids.nameId] = selectedName;
        answers[question.id + '_type'] = answers[ids.typeId];
        answers[question.id + '_name'] = selectedName;
        delete answers[question.id];
        return;
      }
      if (question.type === 'column_selector' && value && typeof value === 'object') {
        const ids = window.getColumnSelectorIds(question.id);
        const name = String(value.name || value.column || '').trim();
        const referencePrice = Number(value.price);
        const match = findBestOption(window.COLUMN_OPTIONS || [], name, 'fullName', referencePrice);
        let selectedCategory;
        let selectedName;
        if (match) {
          selectedCategory = String(match.type || '');
          selectedName = String(match.fullName || '');
        } else if (name) {
          selectedCategory = '__other__';
          selectedName = name;
        } else {
          delete answers[question.id];
          return;
        }
        answers[ids.columnTypeId] = selectedCategory;
        answers[ids.columnNameId] = selectedName;
        const otherPrice = value.price !== undefined && selectedCategory === '__other__' ? String(value.price) : null;
        delete answers[question.id];
        if (otherPrice !== null) answers[question.id] = otherPrice;
        return;
      }
      if (question.type === 'column_selector' && typeof value === 'string') {
        const ids = window.getColumnSelectorIds(question.id);
        const name = value.trim();
        const match = findBestOption(window.COLUMN_OPTIONS || [], name, 'fullName');
        const selectedName = match ? String(match.fullName) : name;
        answers[ids.columnTypeId] = match ? String(match.type || '') : '__other__';
        answers[ids.columnNameId] = selectedName;
        delete answers[question.id];
        return;
      }
      if (question.type === 'recurring_cost_calculator' && value && typeof value === 'object' && !Array.isArray(value)) {
        const comp = value;
        const toEntries = (list, kind) => (Array.isArray(list) ? list : []).map(entry => {
          const name = String((entry && entry.name) || '').trim();
          if (!name) return null;
          const price = Number((entry && entry.price) || 0);
          const stamp = `${kind}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
          if (kind === 'solvent') {
            const percent = Number((entry && entry.percent) ?? 0);
            return { id: stamp, name, percent, amountMgPerL: 0, price, disclaimer: (entry && entry.disclaimer) || '', gradientLetter: '', cost: price * (percent / 100) / 1000 };
          }
          const amountMgPerL = Number((entry && entry.amountMgPerL) ?? (entry && entry.percent) ?? 0);
          return { id: stamp, name, percent: amountMgPerL, amountMgPerL, price, disclaimer: (entry && entry.disclaimer) || '', gradientLetter: '', cost: 0 };
        }).filter(Boolean);
        const normal = toEntries(comp.normalPhaseSolvents, 'solvent');
        const reverse = toEntries(comp.reversePhaseSolvents, 'solvent');
        const buffers = toEntries(comp.buffers, 'buffer');
        const modifiers = toEntries(comp.modifiers, 'modifier');
        const split = dedupeRecurringLists([
          { list: 'normal', entries: normal },
          { list: 'reverse', entries: reverse },
          { list: 'buffers', entries: buffers },
          { list: 'modifiers', entries: modifiers }
        ]);
        const gradientRows = (Array.isArray(comp.gradientRows) && comp.gradientRows.length ? comp.gradientRows : [{ time: 0, values: {} }, { time: 10, values: {} }]).map(row => {
          if (row && row.from !== undefined && row.to !== undefined && row.time === undefined) {
            return { time: Number(row.from || 0), values: row.values || {} };
          }
          return { time: Number((row && row.time) || 0), values: (row && row.values) || {} };
        }).filter(row => Number.isFinite(row.time))
          .sort((a, b) => a.time - b.time)
          .filter((row, index, rows) => index === 0 || Number(row.time) !== Number(rows[index - 1].time));
        answers[question.id + '_run'] = comp.run !== undefined ? String(comp.run) : (answers[question.id + '_run'] || '');
        answers[question.id + '_flow'] = comp.flow !== undefined ? String(comp.flow) : (answers[question.id + '_flow'] || '');
        answers[question.id + '_gradient_flow'] = comp.gradientFlow !== undefined ? String(comp.gradientFlow) : (comp.flow !== undefined ? String(comp.flow) : (answers[question.id + '_gradient_flow'] || ''));
        answers[question.id + '_gradient_mode'] = comp.gradientMode === 'gradient' ? 'gradient' : 'isocratic';
        answers[question.id + '_normal_phase_solvent_entries'] = JSON.stringify(split.normal);
        answers[question.id + '_reverse_phase_solvent_entries'] = JSON.stringify(split.reverse);
        answers[question.id + '_buffer_entries'] = JSON.stringify(split.buffers);
        answers[question.id + '_modifier_entries'] = JSON.stringify(split.modifiers);
        answers[question.id + '_gradient_rows'] = JSON.stringify(gradientRows);
        answers[question.id] = comp.total !== undefined ? String(comp.total) : (answers[question.id] || '');
        return;
      }
      if (question.type === 'equipment_checklist' && Array.isArray(value)) {
        const isSample = String(question.id).startsWith('sample_pretreat_');
        const builtInNames = new Set((getAvailableAnswers(question) || []).map(item => typeof item === 'string' ? item.toLowerCase() : '').filter(Boolean));
        const availableNames = getAvailableAnswers(question).filter(item => typeof item === 'string');
        const items = value.map(item => {
          const rawName = typeof item === 'string' ? item : item?.name;
          const matchedName = findBestLabel(availableNames, rawName);
          if (typeof item === 'string') return isSample ? { name: matchedName || item, amount: 1 } : (matchedName || item);
          if (!isSample && item && item.name) return matchedName || item.name;
          if (item && matchedName) return { ...item, name: matchedName };
          return item;
        }).filter(Boolean);
        answers[question.id + '_items'] = JSON.stringify(items);
        const customItems = value.filter(item => item && typeof item === 'object' && item.name && !builtInNames.has(String(item.name).toLowerCase()) && Number(item.price) > 0);
        if (customItems.length) answers[question.id + '_other_items'] = JSON.stringify(customItems);
        delete answers[question.id];
      }
    });
  }

  function normalizeLabel(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function dedupeRecurringLists(lists) {
    const byName = new Map();
    lists.forEach(({ list, entries }) => (entries || []).forEach(entry => {
      const key = normalizeLabel(entry && entry.name);
      if (!key) return;
      const existing = byName.get(key);
      if (!existing) { byName.set(key, { entry, list }); return; }
      if (Number(entry.price || 0) > Number(existing.entry.price || 0)) byName.set(key, { entry, list });
    }));
    const result = {};
    lists.forEach(({ list }) => { result[list] = []; });
    byName.forEach(({ entry, list }) => result[list].push(entry));
    return result;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = new Array(b.length + 1).fill(0).map((_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const curr = [i];
      for (let j = 1; j <= b.length; j++) {
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = curr;
    }
    return prev[b.length];
  }

  function labelSimilarity(a, b) {
    const maxLen = Math.max(a.length, b.length);
    return maxLen ? 1 - levenshtein(a, b) / maxLen : 1;
  }

  function findBestLabel(labels, value) {
    const normalized = normalizeLabel(value);
    if (!normalized) return null;
    const exact = labels.find(label => normalizeLabel(label) === normalized);
    if (exact) return exact;
    const contains = labels.find(label => normalizeLabel(label).includes(normalized) || normalized.includes(normalizeLabel(label)));
    if (contains) return contains;
    const scored = labels.map(label => ({ label, sim: labelSimilarity(normalizeLabel(label), normalized) }))
      .filter(candidate => candidate.sim >= 0.75)
      .sort((a, b) => b.sim - a.sim);
    return scored.length ? scored[0].label : null;
  }

  function findBestOption(options, value, field, referencePrice) {
    const normalized = normalizeLabel(value);
    if (!normalized) return null;
    const exact = options.find(option => normalizeLabel(option[field]) === normalized);
    if (exact) return exact;
    const contains = options.find(option => normalizeLabel(option[field]).includes(normalized) || normalized.includes(normalizeLabel(option[field])));
    if (contains) return contains;
    const candidates = options.map(option => ({ option, sim: labelSimilarity(normalizeLabel(option[field]), normalized) }))
      .filter(candidate => candidate.sim >= 0.75);
    if (!candidates.length) return null;
    if (Number(referencePrice) > 0) {
      candidates.sort((a, b) => (b.sim - a.sim) || (Math.abs(Number(a.option.price || 0) - Number(referencePrice)) - Math.abs(Number(b.option.price || 0) - Number(referencePrice))));
    } else {
      candidates.sort((a, b) => b.sim - a.sim);
    }
    return candidates[0].option;
  }

  Object.defineProperties(window, {
    buildQuestionnaireJson: { value: buildQuestionnaireJson, configurable: true },
    exportQuestionnaireJson: { value: buildQuestionnaireJson, configurable: true },
    importQuestionnaireJson: { value: importQuestionnaireJson, configurable: true }
  });
}());
