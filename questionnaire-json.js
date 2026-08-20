(function () {
  const FORMAT_VERSION = 1;

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
        names: Array.isArray(window.INSTRUMENT_OPTIONS) ? window.INSTRUMENT_OPTIONS.map(item => ({ category: item.type || '', name: item.name || '' })).filter(item => item.name) : []
      };
    }
    if (question.type === 'column_selector') {
      return {
        categories: (Array.isArray(window.COLUMN_OPTIONS) ? [...new Set(window.COLUMN_OPTIONS.map(item => String(item.type || '')).filter(Boolean))] : []).concat('Other'),
        names: Array.isArray(window.COLUMN_OPTIONS) ? window.COLUMN_OPTIONS.map(item => ({ category: item.type || '', name: item.fullName || '' })).filter(item => item.name) : []
      };
    }
    if (question.type === 'equipment_checklist') {
      return typeof window.getAuxiliaryEquipmentOptions === 'function'
        ? window.getAuxiliaryEquipmentOptions(question.id).map(item => String(item.name || '')).filter(Boolean)
        : [];
    }
    if (question.type === 'recurring_cost_calculator') {
      return {
        normalPhaseSolvents: (Array.isArray(window.SOLVENT_OPTIONS) ? window.SOLVENT_OPTIONS.map(item => String(item.name || '')).filter(Boolean) : []).concat('Other'),
        buffers: (Array.isArray(window.BUFFER_OPTIONS) ? window.BUFFER_OPTIONS.map(item => String(item.name || '')).filter(Boolean) : []).concat('Other')
      };
    }
    return [];
  }

  function buildQuestionnaireJson() {
    if (!Array.isArray(window.QUESTION_AREAS) || !window.QUESTION_AREAS.length) {
      throw new Error('The questionnaire has not loaded yet.');
    }
    if (typeof window.saveCurrentTabAnswers === 'function') window.saveCurrentTabAnswers();

    const questions = [];
    window.QUESTION_AREAS.forEach(area => {
      (area.questions || []).forEach(question => {
        questions.push({
          section: area.title,
          id: question.id,
          text: question.text || question.id,
          type: question.type,
          unit: question.unit || '',
          required: Boolean(question.required),
          helpText: question.help_text || '',
          availableAnswers: getAvailableAnswers(question),
          answerFormat: question.type === 'equipment_dropdown' ? '{ category, name, price? }'
            : question.type === 'column_selector' ? '{ category, name, price? }'
              : question.type === 'equipment_checklist' ? '[string] or [{ name, amount }]'
                : 'single value',
          value: window.ANSWERS[question.id] ?? null
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

    if (typeof window.renderQuestions === 'function') window.renderQuestions();
    if (typeof window.restoreCurrentTabAnswers === 'function') window.restoreCurrentTabAnswers();
    if (typeof window.updateSectionTitle === 'function') window.updateSectionTitle();
    if (typeof window.updateProgress === 'function') window.updateProgress();
    if (typeof window.updateNavButtons === 'function') window.updateNavButtons();
    if (typeof window.checkFormValidity === 'function') window.checkFormValidity();
    if (typeof window.updateCurrentSectionScore === 'function') window.updateCurrentSectionScore();
    return buildQuestionnaireJson();
  }

  function normalizeStructuredAnswers(answers) {
    const questions = (window.QUESTION_AREAS || []).flatMap(area => area.questions || []);
    questions.forEach(question => {
      const value = answers[question.id];
      if (value === undefined || value === null) return;
      if (question.type === 'equipment_dropdown' && value && typeof value === 'object') {
        const ids = window.getEquipmentDropdownIds(question.id);
        const category = String(value.category || value.type || '').trim();
        const name = String(value.name || value.instrument || '').trim();
        answers[ids.typeId] = category === 'Other' || !category ? '__other__' : category;
        answers[ids.nameId] = name;
        answers[question.id + '_type'] = answers[ids.typeId];
        answers[question.id + '_name'] = name;
        if (value.price !== undefined) answers[question.id] = String(value.price);
        console.info('[PharmaScore] Normalized equipment dropdown:', { id: question.id, category, name });
        delete answers[question.id];
        return;
      }
      if (question.type === 'column_selector' && value && typeof value === 'object') {
        const ids = window.getColumnSelectorIds(question.id);
        const category = String(value.category || value.type || '').trim();
        const name = String(value.name || value.column || '').trim();
        answers[ids.columnTypeId] = category === 'Other' || !category ? '__other__' : category;
        answers[ids.columnNameId] = name;
        if (value.price !== undefined) answers[question.id] = String(value.price);
        console.info('[PharmaScore] Normalized column dropdown:', { id: question.id, category, name });
        delete answers[question.id];
        return;
      }
      if (question.type === 'equipment_checklist' && Array.isArray(value)) {
        const isSample = String(question.id).startsWith('sample_pretreat_');
        const items = value.map(item => typeof item === 'string' ? (isSample ? { name: item, amount: 1 } : item) : item).filter(Boolean);
        answers[question.id + '_items'] = JSON.stringify(items);
        console.info('[PharmaScore] Normalized checklist:', { id: question.id, itemCount: items.length, items });
        delete answers[question.id];
      }
    });
  }

  Object.defineProperties(window, {
    buildQuestionnaireJson: { value: buildQuestionnaireJson, configurable: true },
    exportQuestionnaireJson: { value: buildQuestionnaireJson, configurable: true },
    importQuestionnaireJson: { value: importQuestionnaireJson, configurable: true }
  });
}());
