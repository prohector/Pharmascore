(function () {
  function shouldShowQuestion(q) {
    if (!q.show_if_id || !q.show_if_value) return true;
    const parentValue = ANSWERS[q.show_if_id];
    if (parentValue === undefined || parentValue === null || parentValue === '') return false;
    const expectedValue = String(q.show_if_value).trim();
    const actualValue = String(parentValue);
    if (expectedValue.startsWith('!')) {
      return actualValue !== expectedValue.slice(1);
    }
    return actualValue === expectedValue;
  }

  function clearQuestionInputs(q) {
    if (q.type === 'chem_lookup') {
      clearChemLookupResult(q.id);
    }
    const wrapper = document.getElementById('question-wrapper-' + q.id);
    if (wrapper) {
      wrapper.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type === 'radio' || el.type === 'checkbox') el.checked = false;
        else el.value = '';
      });
    }
    delete ANSWERS[q.id];
    if (q.type === 'recurring_cost_calculator') {
      const ids = getRecurringCostIds(q.id);
      delete ANSWERS[ids.columnTypeId];
      delete ANSWERS[ids.columnNameId];
      delete ANSWERS[q.id + '_run'];
      delete ANSWERS[q.id + '_flow'];
      delete ANSWERS[q.id + '_normal_phase_solvent_entries'];
      delete ANSWERS[q.id + '_reverse_phase_solvent_entries'];
      delete ANSWERS[q.id + '_solvent_entries'];
      delete ANSWERS[q.id + '_modifier_entries'];
      delete ANSWERS[q.id + '_buffer_entries'];
      delete ANSWERS[q.id + '_total'];
      RECURRING_MIXES[q.id] = { solvents: [], normalPhaseSolvents: [], reversePhaseSolvents: [], modifiers: [], buffers: [] };
    }
    if (q.type === 'equipment_checklist') {
      delete ANSWERS[q.id + '_items'];
      delete ANSWERS[q.id + '_total'];
      delete ANSWERS[q.id];
    }
    if (q.type === 'column_selector') {
      const ids = getColumnSelectorIds(q.id);
      delete ANSWERS[ids.columnTypeId];
      delete ANSWERS[ids.columnNameId];
      delete ANSWERS[ids.totalId];
    }
    if (q.type === 'equipment_dropdown') {
      const ids = getEquipmentDropdownIds(q.id);
      delete ANSWERS[q.id];
      delete ANSWERS[q.id + '_name'];
      delete ANSWERS[q.id + '_type'];
      delete ANSWERS[ids.typeId];
      delete ANSWERS[ids.nameId];
      delete ANSWERS[q.id + '_total'];
    }
    if (q.type === 'chem_lookup') {
      delete ANSWERS[q.id + '_name'];
      delete ANSWERS[q.id + '_price'];
      delete ANSWERS[q.id + '_grams'];
      delete ANSWERS[q.id + '_total'];
      delete ANSWERS[q.id + '_link'];
    }
  }

  function updateConditionalVisibility() {
    const area = QUESTION_AREAS[currentTab];
    if (!area) return;
    getQuestionsForCurrentView(area).forEach(q => {
      if (!q.show_if_id || !q.show_if_value) return;
      const wrapper = document.getElementById('question-wrapper-' + q.id);
      if (!wrapper) return;
      const visible = shouldShowQuestion(q);
      wrapper.classList.toggle('hidden', !visible);
      if (!visible) {
        clearQuestionInputs(q);
      }
    });
    checkFormValidity();
  }

  function checkFormValidity() {
    let allValid = true;
    for (const area of QUESTION_AREAS) {
      for (const q of area.questions) {
        if (q.type === 'label') continue;
        const wrapper = document.getElementById('question-wrapper-' + q.id);
        if (wrapper && wrapper.classList.contains('hidden')) continue;
        if (!wrapper) continue;
        if (!q.required) continue;
        const val = ANSWERS[q.id];
        if (q.type === 'dropdown') {
          if (!val || val === '') { allValid = false; break; }
        } else if (q.type === 'boolean') {
          if (val !== 'true' && val !== 'false') { allValid = false; break; }
        } else if (q.type === 'number' || q.type === 'chem_lookup' || q.type === 'recurring_cost_calculator' || q.type === 'column_selector' || q.type === 'equipment_dropdown' || q.type === 'equipment_checklist') {
          if (val === undefined || val === '' || isNaN(Number(val))) { allValid = false; break; }
        } else if (q.type === 'text') {
          if (!val || !val.trim()) { allValid = false; break; }
        } else {
          if (!val) { allValid = false; break; }
        }
      }
      if (!allValid) break;
    }
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.disabled = !allValid;
  }

  document.addEventListener('input', function (e) {
    const el = e.target;
    if (el && el.id) {
      ANSWERS[el.id] = el.value;
    }
    updateConditionalVisibility();
    checkFormValidity();
    if (typeof window.updateCurrentSectionScore === 'function') window.updateCurrentSectionScore();
  });

  document.addEventListener('DOMContentLoaded', function () {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    if (prevBtn) prevBtn.addEventListener('click', () => navigateView(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateView(1));
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        let allValid = true;
        for (const area of QUESTION_AREAS) {
          for (const q of area.questions) {
            if (q.type === 'label') continue;
            const wrapper = document.getElementById('question-wrapper-' + q.id);
            if (wrapper && wrapper.classList.contains('hidden')) continue;
            if (!wrapper) continue;
            if (!q.required) continue;
            const val = ANSWERS[q.id];
            if (q.type === 'dropdown') {
              if (!val || val === '') { allValid = false; break; }
            } else if (q.type === 'boolean') {
              if (val !== 'true' && val !== 'false') { allValid = false; break; }
            } else if (q.type === 'number' || q.type === 'chem_lookup' || q.type === 'recurring_cost_calculator' || q.type === 'column_selector' || q.type === 'equipment_dropdown' || q.type === 'equipment_checklist') {
              if (val === undefined || val === '' || isNaN(Number(val))) { allValid = false; break; }
            } else if (q.type === 'text') {
              if (!val || !val.trim()) { allValid = false; break; }
            } else {
              if (!val) { allValid = false; break; }
            }
          }
          if (!allValid) break;
        }
        if (!allValid) return;
        document.querySelector('main').classList.add('hidden');
        document.getElementById('results-section').classList.remove('hidden');
        const scores = calculateScores(QUESTION_AREAS, ANSWERS, ANALYSIS_MODE);
        renderEquipmentPriceSummary();
        renderResultsGraphic(scores);
        document.getElementById('debug-scores').textContent = 'Scores: ' + JSON.stringify(scores);
      });
    }
  });

  Object.defineProperties(window, {
    shouldShowQuestion: { value: shouldShowQuestion, configurable: true },
    clearQuestionInputs: { value: clearQuestionInputs, configurable: true },
    updateConditionalVisibility: { value: updateConditionalVisibility, configurable: true },
    checkFormValidity: { value: checkFormValidity, configurable: true }
  });
}());
