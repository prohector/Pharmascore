(function () {
  function isFixedCostsArea(area) {
    return !!area && area.title === 'Equipment Fixed Costs';
  }

  function isAnalyticalPerformanceArea(area) {
    return !!area && area.title === 'Analytical Performance';
  }

  function isAnalyticalConsumablesArea(area) {
    return !!area && area.title === 'Analytical Consumables';
  }

  function getFixedCostSubTab() {
    return FIXED_COST_SUBTABS[fixedCostsSubTab] || FIXED_COST_SUBTABS[0];
  }

  function getAnalyticalPerformanceSubTab() {
    return ANALYTICAL_PERFORMANCE_SUBTABS[analyticalPerformanceSubTab] || ANALYTICAL_PERFORMANCE_SUBTABS[0];
  }

  function getAnalyticalConsumablesSubTab() {
    return ANALYTICAL_CONSUMABLES_SUBTABS[analyticalConsumablesSubTab] || ANALYTICAL_CONSUMABLES_SUBTABS[0];
  }

  function getQuestionsForCurrentView(area) {
    if (!area) return [];
    if (isFixedCostsArea(area)) {
      const selectedIds = new Set((getFixedCostSubTab().questionIds || []));
      return area.questions.filter(q => selectedIds.has(q.id) && !(ANALYSIS_MODE === 'routine' && q.id === 'aux_pretreat_omics'));
    }
    if (isAnalyticalPerformanceArea(area)) {
      const selectedIds = new Set((getAnalyticalPerformanceSubTab().questionIds || []));
      return area.questions.filter(q => selectedIds.has(q.id));
    }
    if (isAnalyticalConsumablesArea(area)) {
      const selectedIds = new Set((getAnalyticalConsumablesSubTab().questionIds || []));
      return area.questions.filter(q => selectedIds.has(q.id));
    }
    return area.questions;
  }

  function toggleSectionGuidance(forceOpen) {
    const toggle = document.getElementById('section-guidance-toggle');
    const guidance = document.getElementById('section-guidance');
    if (!toggle || !guidance) return;
    const shouldOpen = forceOpen !== undefined ? forceOpen : guidance.classList.contains('hidden');
    guidance.classList.toggle('hidden', !shouldOpen);
    toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    toggle.textContent = shouldOpen ? 'Close help' : 'Help';
  }

  function updateSectionGuidance() {
    const area = QUESTION_AREAS[currentTab];
    if (!area) return;
    const guidance = SECTION_GUIDANCE[area.title] || {
      summary: 'Complete each required field in this section with your method data.',
      steps: [
        'Read each question label before entering values.',
        'Use values from your records for consistency.',
        'Move to the next tab when all required fields are complete.'
      ]
    };
    const titleEl = document.getElementById('guidance-title');
    const summaryEl = document.getElementById('guidance-summary');
    const stepsEl = document.getElementById('guidance-steps');
    const subtitleEl = document.getElementById('section-subtitle');
    if (titleEl) titleEl.textContent = `How To Complete: ${area.title}`;
    if (summaryEl) summaryEl.textContent = guidance.summary;
    if (subtitleEl) {
      if (isFixedCostsArea(area)) {
        subtitleEl.textContent = `${getFixedCostSubTab().title}. ${guidance.summary}`;
      } else if (isAnalyticalPerformanceArea(area)) {
        subtitleEl.textContent = `${getAnalyticalPerformanceSubTab().title}. ${guidance.summary}`;
      } else if (isAnalyticalConsumablesArea(area)) {
        subtitleEl.textContent = `${getAnalyticalConsumablesSubTab().title}. ${guidance.summary}`;
      } else {
        subtitleEl.textContent = guidance.summary;
      }
    }
    if (stepsEl) {
      stepsEl.innerHTML = guidance.steps.map(step => `<li>${step}</li>`).join('');
      if (typeof window.renderMathInElement === 'function') {
        window.renderMathInElement(stepsEl, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }
    }
    updateCurrentSectionScore();
  }

  function updateCurrentSectionScore() {
    const scoreEl = document.getElementById('current-section-score');
    const area = QUESTION_AREAS[currentTab];
    if (!scoreEl || !area || typeof calculateScores !== 'function') return;
    const visibleQuestions = getQuestionsForCurrentView(area).filter(question => question && question.type !== 'label');
    const scoreArea = { ...area, questions: visibleQuestions };
    const scores = calculateScores([scoreArea], ANSWERS, ANALYSIS_MODE);
    const score = Number(scores[area.title] || 0);
    const subsectionTitle = isFixedCostsArea(area)
      ? getFixedCostSubTab().title
      : isAnalyticalPerformanceArea(area)
        ? getAnalyticalPerformanceSubTab().title
        : isAnalyticalConsumablesArea(area)
          ? getAnalyticalConsumablesSubTab().title
          : area.title;
    scoreEl.innerHTML = `<span>${subsectionTitle} score: ${score}/100</span>`;
    scoreEl.classList.remove('hidden');
  }

  function getQuestionThresholdScore(questionId, value) {
    const question = QUESTION_AREAS.flatMap(area => area.questions || []).find(item => item.id === questionId);
    if (!question) return 0;
    try {
      const params = typeof question.params === 'object' ? question.params : JSON.parse(question.params || '{}');
      if (typeof window.scoreCustomQuestionValue === 'function') {
        const customScore = window.scoreCustomQuestionValue(value, question.method, params);
        if (customScore !== null) return Math.round(customScore);
      }
      const activeRanges = Array.isArray(params.ranges)
        ? params.ranges
        : params[ANALYSIS_MODE] && Array.isArray(params[ANALYSIS_MODE].ranges)
          ? params[ANALYSIS_MODE].ranges
          : [];
      const matchingRange = activeRanges
        .filter(range => Number(value) <= Number(range.max))
        .sort((a, b) => Number(a.max) - Number(b.max))[0];
      return matchingRange ? Math.round(Number(matchingRange.score)) : 0;
    } catch {
      return 0;
    }
  }

  function renderFixedCostSubTabs() {
    const area = QUESTION_AREAS[currentTab];

    const fixedContainer = document.getElementById('fixed-cost-subtabs');
    if (fixedContainer) {
      if (!isFixedCostsArea(area)) {
        fixedContainer.classList.add('hidden');
        fixedContainer.innerHTML = '';
      } else {
        fixedContainer.innerHTML = FIXED_COST_SUBTABS.map((tab, idx) => `
          <button
            type="button"
            class="fixed-cost-subtab ${idx === fixedCostsSubTab ? 'active' : ''}"
            data-subtab-index="${idx}"
          >
            ${tab.title}
          </button>
        `).join('');
        fixedContainer.classList.remove('hidden');
        fixedContainer.querySelectorAll('.fixed-cost-subtab').forEach(button => {
          button.addEventListener('click', () => {
            if (typeof saveCurrentTabAnswers === 'function') saveCurrentTabAnswers();
            fixedCostsSubTab = Number(button.dataset.subtabIndex || 0);
            renderFixedCostSubTabs();
            renderTabs();
            renderQuestions();
            if (typeof restoreCurrentTabAnswers === 'function') restoreCurrentTabAnswers();
            updateSectionTitle();
            updateProgress();
            updateNavButtons();
            updateSectionGuidance();
            checkFormValidity();
          });
        });
      }
    }

    const analyticalPerformanceContainer = document.getElementById('analytical-performance-subtabs');
    if (analyticalPerformanceContainer) {
      if (!isAnalyticalPerformanceArea(area)) {
        analyticalPerformanceContainer.classList.add('hidden');
        analyticalPerformanceContainer.innerHTML = '';
      } else {
        analyticalPerformanceContainer.innerHTML = ANALYTICAL_PERFORMANCE_SUBTABS.map((tab, idx) => `
          <button
            type="button"
            class="analytical-performance-subtab ${idx === analyticalPerformanceSubTab ? 'active' : ''}"
            data-analytical-performance-subtab-index="${idx}"
          >
            ${tab.title}
          </button>
        `).join('');
        analyticalPerformanceContainer.classList.remove('hidden');
        analyticalPerformanceContainer.querySelectorAll('.analytical-performance-subtab').forEach(button => {
          button.addEventListener('click', () => {
            if (typeof saveCurrentTabAnswers === 'function') saveCurrentTabAnswers();
            analyticalPerformanceSubTab = Number(button.dataset.analyticalPerformanceSubtabIndex || 0);
            renderFixedCostSubTabs();
            renderTabs();
            renderQuestions();
            if (typeof restoreCurrentTabAnswers === 'function') restoreCurrentTabAnswers();
            updateSectionTitle();
            updateProgress();
            updateNavButtons();
            updateSectionGuidance();
            checkFormValidity();
          });
        });
      }
    }

    const analyticalContainer = document.getElementById('analytical-consumables-subtabs');
    if (analyticalContainer) {
      if (!isAnalyticalConsumablesArea(area)) {
        analyticalContainer.classList.add('hidden');
        analyticalContainer.innerHTML = '';
      } else {
        analyticalContainer.innerHTML = ANALYTICAL_CONSUMABLES_SUBTABS.map((tab, idx) => `
          <button
            type="button"
            class="analytical-consumables-subtab ${idx === analyticalConsumablesSubTab ? 'active' : ''}"
            data-analytical-subtab-index="${idx}"
          >
            ${tab.title}
          </button>
        `).join('');
        analyticalContainer.classList.remove('hidden');
        analyticalContainer.querySelectorAll('.analytical-consumables-subtab').forEach(button => {
          button.addEventListener('click', () => {
            if (typeof saveCurrentTabAnswers === 'function') saveCurrentTabAnswers();
            analyticalConsumablesSubTab = Number(button.dataset.analyticalSubtabIndex || 0);
            renderFixedCostSubTabs();
            renderTabs();
            renderQuestions();
            if (typeof restoreCurrentTabAnswers === 'function') restoreCurrentTabAnswers();
            updateSectionTitle();
            updateProgress();
            updateNavButtons();
            updateSectionGuidance();
            checkFormValidity();
          });
        });
      }
    }
  }

  function renderEquipmentPriceSummary() {
    const summaryEl = document.getElementById('results-price-summary');
    if (!summaryEl) return;
    let total = 0;
    const equipmentRows = [];

    for (const area of QUESTION_AREAS) {
      for (const q of area.questions) {
        if (!q || q.type === 'label') continue;
        const value = ANSWERS[q.id];
        if (value === undefined || value === '') continue;
        const price = Number(value);
        if (!isNaN(price)) {
          total += price;
          equipmentRows.push(`<li>${q.id}: ${price.toFixed(2)} €</li>`);
        }
      }
    }

    summaryEl.innerHTML = `
      <div class="results-price-summary-header">
        <strong>Total score</strong>
        <span>${total.toFixed(2)} €</span>
      </div>
      <ul>${equipmentRows.join('')}</ul>
    `;
  }

  function showQuestionnaireIfReady() {
    if (!ANALYSIS_GATE_CHOSEN) return;
    const main = document.querySelector('main');
    const gate = document.getElementById('analysis-gate');
    const nav = document.querySelector('nav');
    const progress = document.getElementById('progress-indicator');
    if (!QUESTIONS_LOADED || QUESTIONS_LOAD_FAILED) return;
    if (main) main.classList.remove('hidden');
    if (nav) nav.classList.remove('hidden');
    if (progress) progress.classList.remove('hidden');
    if (gate) gate.classList.add('hidden');
    if (window.renderTabs) renderTabs();
    if (window.renderQuestions) renderQuestions();
    if (window.updateSectionTitle) updateSectionTitle();
    if (window.updateProgress) updateProgress();
    if (window.updateNavButtons) updateNavButtons();
    if (window.updateSectionGuidance) updateSectionGuidance();
    if (window.checkFormValidity) checkFormValidity();
  }

  function chooseAnalysisMode(mode) {
    const autoFill = document.getElementById('analysis-pdf-autofill');
    const fileInput = document.getElementById('analysis-pdf-file');
    if (autoFill && autoFill.checked && fileInput) {
      fileInput.dataset.analysisMode = mode;
      const status = document.getElementById('analysis-pdf-status');
      if (status) status.textContent = 'Choose a selectable-text PDF to begin auto-fill.';
      fileInput.click();
      return;
    }
    ANALYSIS_MODE = mode;
    ANALYSIS_GATE_CHOSEN = true;
    showQuestionnaireIfReady();
  }

  function updateSectionTitle() {
    const titleEl = document.getElementById('section-title');
    const iconSlot = titleEl ? titleEl.querySelector('.section-icon-slot') : null;
    const textEl = titleEl ? titleEl.querySelector('.section-title-text') : null;
    const area = QUESTION_AREAS[currentTab];
    if (!area) return;
    if (textEl) textEl.textContent = area.title;
    if (iconSlot) {
      const iconAsset = iconAssetFromAreaTitle(area.title);
      if (iconAsset) {
        iconSlot.style.setProperty('--icon-url', `url('../assets/${iconAsset}')`);
      }
    }
    updateSectionGuidance();
  }

  function getAreaSubTabCount(area) {
    if (isFixedCostsArea(area)) return FIXED_COST_SUBTABS.length;
    if (isAnalyticalPerformanceArea(area)) return ANALYTICAL_PERFORMANCE_SUBTABS.length;
    if (isAnalyticalConsumablesArea(area)) return ANALYTICAL_CONSUMABLES_SUBTABS.length;
    return 1;
  }

  function getAreaSubTabIndex(area) {
    if (isFixedCostsArea(area)) return fixedCostsSubTab;
    if (isAnalyticalPerformanceArea(area)) return analyticalPerformanceSubTab;
    if (isAnalyticalConsumablesArea(area)) return analyticalConsumablesSubTab;
    return 0;
  }

  function updateProgress() {
    const progressBar = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');
    if (!QUESTION_AREAS.length) return;
    const totalSteps = QUESTION_AREAS.reduce((total, area) => total + getAreaSubTabCount(area), 0);
    let index = 0;
    for (let i = 0; i < currentTab; i++) {
      index += getAreaSubTabCount(QUESTION_AREAS[i]);
    }
    const currentArea = QUESTION_AREAS[currentTab];
    if (currentArea) index += getAreaSubTabIndex(currentArea);
    const stepNumber = Math.min(index + 1, totalSteps);
    const percent = totalSteps > 0 ? (stepNumber / totalSteps) * 100 : 0;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressLabel) {
      progressLabel.textContent = `Category ${stepNumber} of ${totalSteps}: ${currentArea ? currentArea.title : 'Category'}`;
    }
  }

  function updateNavButtons() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    const currentArea = QUESTION_AREAS[currentTab];
    if (!currentArea) return;

    const isFirst = currentTab === 0 && getAreaSubTabIndex(currentArea) === 0;
    const isLast = currentTab === QUESTION_AREAS.length - 1 && getAreaSubTabIndex(currentArea) === getAreaSubTabCount(currentArea) - 1;
    if (prevBtn) prevBtn.classList.toggle('hidden', isFirst);
    if (nextBtn) nextBtn.classList.toggle('hidden', isLast);
    if (submitBtn) submitBtn.classList.toggle('hidden', !isLast);
  }

  function iconKeyFromText(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/&amp;/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
  }

  function iconAssetFromAreaTitle(title) {
    const icons = {
      'Green assessment': 'noun_leaf_8158036_@700.png',
      'Equipment Fixed Costs': 'noun_lab_3020074_@700.png',
      'Analytical Consumables': 'noun_Money_8127580_@700.png',
      Practicality: 'noun_service_5454640_@700.png',
      'Analytical Performance': 'noun_performance_831861_@700.png'
    };
    return icons[title] || '';
  }

  function renderTabs() {
    const tabNav = document.getElementById('tab-nav');
    if (!tabNav) return;
    tabNav.innerHTML = '';
    QUESTION_AREAS.forEach((area, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab-btn' + (idx === currentTab ? ' tab-btn-active' : '');
      const iconKey = iconKeyFromText(area.title);
      btn.innerHTML = `<span class="tab-icon-slot" data-icon-key="${iconKey}" aria-hidden="true"></span><span class="tab-label">${area.title}</span>`;
      const iconAsset = iconAssetFromAreaTitle(area.title);
      if (iconAsset) {
        btn.querySelector('.tab-icon-slot').style.setProperty('--icon-url', `url('../assets/${iconAsset}')`);
      }
      btn.onclick = () => { goToTab(idx); };
      tabNav.appendChild(btn);
    });
  }

  function formatUnitLabel(unit) {
    if (unit === null || unit === undefined) return '';
    const raw = String(unit).trim();
    if (!raw) return '';

    const lower = raw.toLowerCase();
    if (lower === 'mins' || lower === 'minutes' || lower === 'minute' || lower === 'min') return 'min';
    if (lower === 'ml' || lower === 'milliliter' || lower === 'millilitres') return 'mL';
    if (lower === 'μg/ml' || lower === 'ug/ml' || lower === 'µg/ml') return 'μg/mL';

    return raw
      .replace(/\bmins?\b/gi, 'min')
      .replace(/\bminutes?\b/gi, 'min')
      .replace(/\bml\b/gi, 'mL');
  }

  function getQuestionDisplayText(q) {
    if (q && (q.id === 'perf1' || q.id === 'perf17')) {
      const label = q.id === 'perf17' ? 'Enter reliable detection limit in matrix' : 'Enter method LOQ';
      const unit = ANALYSIS_MODE === 'advanced' ? 'ng/mL' : 'µg/mL';
      return `${label} (${unit})`;
    }
    return q && (q.text || q.id) || '';
  }

  function getQuestionDisplayUnit(q) {
    if (q && (q.id === 'perf1' || q.id === 'perf17')) return ANALYSIS_MODE === 'advanced' ? 'ng/mL' : 'µg/mL';
    return q ? q.unit : '';
  }

  function getQuestionInfoText(q) {
    if (!q) return '';
    if (q.id === 'perf14') return String.raw`$$\text{Matrix Effect (\%)} = \left( \frac{\text{Peak area (post-extraction spiked sample)}}{\text{Peak area (neat standard)}} - 1 \right) \times 100$$`;
    if (q.id === 'perf15') return String.raw`$$\text{Process efficiency (\%)} = \text{matrix recovery} \times \text{matrix effect}.$$`;
    return '';
  }

  function renderSimpleSelect(selectId, options, placeholder, valueField = 'value', labelField = 'label') {
    const optionElements = options.map(opt => {
      const val = opt[valueField] !== undefined ? opt[valueField] : opt;
      const label = opt[labelField] !== undefined ? opt[labelField] : opt;
      return `<option value="${String(val)}">${String(label)}</option>`;
    }).join('');
    return `
      <select id="${selectId}" name="${selectId}" class="form-input" required>
        <option value="">${placeholder}</option>
        ${optionElements}
      </select>
    `;
  }

  function renderMappedSelect(selectId, optionsMap, placeholder) {
    const groups = optionsMap && typeof optionsMap === 'object' ? Object.entries(optionsMap) : [];
    return `
      <select id="${selectId}" name="${selectId}" class="form-input" required>
        <option value="">${placeholder}</option>
        ${groups.map(([groupLabel, items]) => {
          if (Array.isArray(items)) {
            return `<optgroup label="${groupLabel}">${items.map(item => `<option value="${String(item.value)}">${item.label}</option>`).join('')}</optgroup>`;
          }
          return `<option value="${String(items)}">${groupLabel}</option>`;
        }).join('')}
      </select>
    `;
  }

  function getColumnSelectorIds(questionId) {
    return {
      wrapperId: `${questionId}_column_selector`,
      columnTypeId: `${questionId}_column_type`,
      columnNameId: `${questionId}_column_name`,
      totalId: `${questionId}_total`
    };
  }

  function getEquipmentDropdownIds(questionId) {
    return {
      wrapperId: `${questionId}_equipment_dropdown`,
      typeId: `${questionId}_type`,
      nameId: `${questionId}_name`,
      totalId: `${questionId}_total`
    };
  }

  function getOtherLookupIds(id) {
    return {
      wrapId: `${id}_other_lookup`,
      nameId: `${id}_other_name`,
      queryId: `${id}_other_query`,
      priceId: `${id}_other_price`,
      messageId: `${id}_other_message`
    };
  }

  function renderOtherLookupControls(id, unit = 'g') {
    const ids = getOtherLookupIds(id);
    return `
      <div id="${ids.wrapId}" class="other-lookup hidden">
        <label for="${ids.nameId}" class="input-label-small">Name</label>
        <input id="${ids.nameId}" type="text" class="form-input" placeholder="Enter a chemical or item name">
        <div class="other-lookup-actions">
          <span class="input-label-small">Price basis: per ${unit === 'item' ? 'item' : unit === 'ml' ? 'milliliter' : 'gram'}</span>
          <button id="${ids.queryId}" type="button" class="recurring-add-btn">Query</button>
        </div>
        <label for="${ids.priceId}" class="input-label-small">Price (EUR)</label>
        <input id="${ids.priceId}" type="number" min="0" step="any" class="form-input hidden" placeholder="Enter or edit the price">
        <div id="${ids.messageId}" class="other-lookup-message" aria-live="polite"></div>
      </div>`;
  }

  function setOtherLookupVisibility(id, visible) {
    const wrap = document.getElementById(getOtherLookupIds(id).wrapId);
    if (wrap) wrap.classList.toggle('hidden', !visible);
  }

  function setupOtherLookup(id, unit, questionText, onSuccess) {
    const ids = getOtherLookupIds(id);
    const query = document.getElementById(ids.queryId);
    if (!query) return;
    query.addEventListener('click', async () => {
      const nameEl = document.getElementById(ids.nameId);
      const priceEl = document.getElementById(ids.priceId);
      const messageEl = document.getElementById(ids.messageId);
      const name = nameEl ? nameEl.value.trim() : '';
      if (priceEl) priceEl.classList.remove('hidden');
      if (!name) {
        if (messageEl) messageEl.textContent = 'Enter a name before querying.';
        return;
      }
      query.disabled = true;
      if (messageEl) messageEl.textContent = 'Querying an AI price estimate. You can edit the price in the field below when it appears...';
      const result = await window.lookupChemicalPrice(name, 'US', unit, questionText);
      query.disabled = false;
      if (!result.success) {
        if (priceEl) priceEl.value = '';
        if (messageEl) messageEl.textContent = `${result.error || 'No reliable estimate was found.'} You can enter a price manually below.`;
        return;
      }
      if (priceEl) priceEl.value = String(result.price);
      if (messageEl) messageEl.textContent = `${result.disclaimer || 'AI-estimated price. Verify before relying on it.'} Confidence: ${result.confidence || 'low'}. You can edit the price below if needed.`;
      onSuccess({ name, unit, price: Number(result.price), disclaimer: result.disclaimer || 'AI-estimated price. Verify before relying on it.' });
    });
    const priceEl = document.getElementById(ids.priceId);
    if (priceEl) {
      priceEl.addEventListener('input', () => onSuccess({
        name: document.getElementById(ids.nameId)?.value.trim() || '',
        unit,
        price: Number(priceEl.value),
        disclaimer: ''
      }));
    }
  }

  function populateInstrumentNames(questionId, selectedType, ids = getEquipmentDropdownIds(questionId)) {
    const nameEl = document.getElementById(ids.nameId);
    if (!nameEl) return;

    const filtered = (Array.isArray(INSTRUMENT_OPTIONS) ? INSTRUMENT_OPTIONS : []).filter(inst => String(inst.type || 'Other') === String(selectedType));
    const currentValue = nameEl.value;
    nameEl.innerHTML = '<option value="">Select instrument...</option>' + filtered.map(inst => `<option value="${String(inst.name).replace(/"/g, '&quot;')}" data-price="${Number(inst.price || 0)}">${inst.name}</option>`).join('');

    if (filtered.length && currentValue && filtered.some(inst => String(inst.name) === String(currentValue))) {
      nameEl.value = currentValue;
    } else if (filtered.length) {
      nameEl.value = filtered[0].name;
    }

    updateInstrumentDropdownTotal(questionId, ids);
  }

  function updateInstrumentDropdownTotal(questionId, ids = getEquipmentDropdownIds(questionId)) {
    const typeEl = document.getElementById(ids.typeId);
    const nameEl = document.getElementById(ids.nameId);
    const totalEl = document.getElementById(ids.totalId);
    if (!nameEl || !typeEl) return;

    const selectedType = typeEl.value;
    const selectedName = nameEl.value;
    const selected = (Array.isArray(INSTRUMENT_OPTIONS) ? INSTRUMENT_OPTIONS : []).find(inst => String(inst.type || 'Other') === String(selectedType) && String(inst.name) === String(selectedName));
    const otherPrice = Number(document.getElementById(getOtherLookupIds(questionId).priceId)?.value || 0);
    const price = selectedType === '__other__' ? otherPrice : (Number(selected && selected.price ? selected.price : 0) || 0);

    if (selectedType === '__other__' && (!Number.isFinite(price) || price <= 0)) {
      delete ANSWERS[questionId];
      delete ANSWERS[questionId + '_total'];
      return;
    }

    if (totalEl) totalEl.value = String(price.toFixed(2));
    const scoreOutput = document.getElementById(`${questionId}_score_output`);
    if (scoreOutput) scoreOutput.textContent = `Score: ${getQuestionThresholdScore(questionId, price)}/100`;
    ANSWERS[questionId] = String(price);
    ANSWERS[questionId + '_total'] = String(price);
    ANSWERS[questionId + '_name'] = selectedType === '__other__' ? (nameEl.dataset.otherName || '') : (selectedName || '');
    ANSWERS[questionId + '_type'] = selectedType || '';
  }

  function getRecurringCostIds(questionId) {
    return {
      runId: `${questionId}_run`,
      flowId: `${questionId}_flow`,
      gradientFlowId: `${questionId}_gradient_flow`,
      normalPhaseSelectId: `${questionId}_normal_phase_select`,
      normalPhasePctId: `${questionId}_normal_phase_pct`,
      reversePhaseSelectId: `${questionId}_reverse_phase_select`,
      reversePhasePctId: `${questionId}_reverse_phase_pct`,
      bufferSelectId: `${questionId}_buffer_select`,
      bufferPctId: `${questionId}_buffer_pct`,
      modifierSelectId: `${questionId}_modifier_select`,
      modifierPctId: `${questionId}_modifier_pct`,
      totalId: `${questionId}_total`,
      normalPhaseListId: `${questionId}_normal_phase_list`,
      reversePhaseListId: `${questionId}_reverse_phase_list`,
      bufferListId: `${questionId}_buffer_list`,
      modifierListId: `${questionId}_modifier_list`,
      modeGroupName: `${questionId}_mode_group`,
      isocraticModeId: `${questionId}_mode_isocratic`,
      gradientModeId: `${questionId}_mode_gradient`,
      gradientTableId: `${questionId}_gradient_table`,
      gradientTableWrapId: `${questionId}_gradient_table_wrap`,
      messageId: `${questionId}_message`
    };
  }

  function renderGroupedSelectOptions(items, groupKey = 'type') {
    if (!Array.isArray(items) || !items.length) return '';
    const groups = items.reduce((acc, item) => {
      const groupName = String(item[groupKey] || 'Other');
      if (!acc[groupName]) acc[groupName] = [];
      acc[groupName].push(item);
      return acc;
    }, {});

    return Object.entries(groups).map(([groupName, groupItems]) => `
      <optgroup label="${String(groupName).replace(/"/g, '&quot;')}">
        ${groupItems.map(item => `<option value="${String(item.name).replace(/"/g, '&quot;')}" data-price="${Number(item.price || 0)}">${String(item.name)}</option>`).join('')}
      </optgroup>
    `).join('') + '<option value="__other__">Other</option>';
  }

  function getRecurringMix(questionId) {
    if (!window.RECURRING_MIXES) window.RECURRING_MIXES = {};
    if (!window.RECURRING_MIXES[questionId]) {
      window.RECURRING_MIXES[questionId] = {
        solvents: [],
        normalPhaseSolvents: [],
        reversePhaseSolvents: [],
        modifiers: [],
        buffers: [],
        gradientMode: 'isocratic',
        gradientRows: [{ time: 0, values: {} }, { time: 10, values: {} }]
      };
    }
    return window.RECURRING_MIXES[questionId];
  }

  function normalizeGradientRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(row => {
      if (row && row.from !== undefined && row.to !== undefined && row.time === undefined) {
        return { time: Number(row.from || 0), values: row.values || {} };
      }
      return { time: Number((row && row.time) || 0), values: (row && row.values) || {} };
    });
  }

  function computeAutocompleteA(letters, values) {
    const sumOthers = (letters || []).filter(letter => letter !== 'A')
      .reduce((sum, letter) => sum + Number((values && values[letter]) ?? 0), 0);
    return 100 - sumOthers;
  }

  function normalizeRecurringEntryName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function showRecurringCostMessage(questionId, message, kind = 'error') {
    const ids = getRecurringCostIds(questionId);
    const messageEl = document.getElementById(ids.messageId);
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.classList.remove('hidden', 'is-success');
    messageEl.classList.toggle('is-success', kind === 'success');
    messageEl.classList.toggle('is-error', kind === 'error');
  }

  function clearRecurringCostMessage(questionId) {
    const ids = getRecurringCostIds(questionId);
    const messageEl = document.getElementById(ids.messageId);
    if (!messageEl) return;
    messageEl.textContent = '';
    messageEl.classList.add('hidden');
    messageEl.classList.remove('is-error', 'is-success');
  }

  function buildGradientAssignments(questionId) {
    const mix = getRecurringMix(questionId);
    const entries = [...(mix.normalPhaseSolvents || []), ...(mix.reversePhaseSolvents || [])];
    const waterEntry = entries.find(entry => /water/i.test(String(entry.name || '')));
    const assignments = [];
    const order = waterEntry ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D'];
    let letterIndex = 0;

    if (waterEntry) {
      assignments.push({ letter: 'A', entry: waterEntry, editable: false });
      letterIndex = 1;
    }

    entries.forEach(entry => {
      if (waterEntry && normalizeRecurringEntryName(entry.name) === normalizeRecurringEntryName(waterEntry.name)) return;
      if (letterIndex >= order.length) return;
      const letter = order[letterIndex];
      assignments.push({ letter, entry, editable: letter !== 'A' });
      letterIndex += 1;
    });

    return assignments;
  }

  function syncGradientLetters(questionId) {
    const mix = getRecurringMix(questionId);
    const assignments = buildGradientAssignments(questionId);
    const allEntries = [...(mix.normalPhaseSolvents || []), ...(mix.reversePhaseSolvents || [])];
    allEntries.forEach(entry => {
      const match = assignments.find(item => normalizeRecurringEntryName(item.entry.name) === normalizeRecurringEntryName(entry.name));
      entry.gradientLetter = match ? match.letter : '';
    });
    const waterEntry = allEntries.find(entry => /water/i.test(String(entry.name || '')));
    if (waterEntry) {
      waterEntry.gradientLetter = 'A';
    }
  }

  function applyRecurringModeVisibility(questionId, wrapper) {
    const ids = getRecurringCostIds(questionId);
    const mix = getRecurringMix(questionId);
    const mode = mix.gradientMode || 'isocratic';
    const root = wrapper || document.getElementById(`${questionId}_calculator`);

    const isocraticModeEl = document.getElementById(ids.isocraticModeId);
    const gradientModeEl = document.getElementById(ids.gradientModeId);
    if (isocraticModeEl) isocraticModeEl.checked = mode === 'isocratic';
    if (gradientModeEl) gradientModeEl.checked = mode === 'gradient';

    if (root) {
      root.querySelectorAll('[data-gradient-percent-field]').forEach(field => {
        const fieldWrap = field.closest('.recurring-cost-field');
        if (fieldWrap) fieldWrap.classList.toggle('hidden', mode === 'gradient');
      });
      root.querySelectorAll('[data-gradient-runtime-fields]').forEach(field => {
        field.classList.toggle('hidden', mode === 'gradient');
      });
    }

    const tableWrap = document.getElementById(ids.gradientTableWrapId);
    if (tableWrap) tableWrap.classList.toggle('hidden', mode !== 'gradient');

    renderGradientTable(questionId);
  }

  function renderGradientTable(questionId) {
    const ids = getRecurringCostIds(questionId);
    const tableWrap = document.getElementById(ids.gradientTableWrapId);
    const tableEl = document.getElementById(ids.gradientTableId);
    const mix = getRecurringMix(questionId);
    if (!tableWrap || !tableEl) return;

    syncGradientLetters(questionId);
    const assignments = buildGradientAssignments(questionId);
    const letters = assignments.map(item => item.letter);
    const firstLetter = letters[0] || 'A';
    const rows = normalizeGradientRows(mix.gradientRows);
    if (!rows.length) rows.push({ time: 0, values: {} });
    rows.forEach(row => {
      row.values = row.values || {};
      row.values[firstLetter] = computeAutocompleteA(letters, row.values);
    });

    tableEl.innerHTML = `
      <thead>
        <tr>
          <th>Time (min)</th>
          ${assignments.map((assignment, idx) => `<th${idx === 0 ? ' class="gradient-auto-col"' : ''}>${assignment.entry.name}${idx === 0 ? ' (auto)' : ''}</th>`).join('')}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, rowIndex) => `
          <tr>
            <td><input type="number" min="0" step="any" data-row-index="${rowIndex}" data-field="time" value="${Number(row.time || 0)}"></td>
            ${letters.map(letter => {
              const value = row.values[letter] !== undefined ? row.values[letter] : '';
              const readOnly = letter === firstLetter;
              return `<td><input type="number" min="0" max="100" step="any" data-row-index="${rowIndex}" data-field="${letter}" value="${value}" ${readOnly ? 'readonly class="gradient-readonly"' : ''}${readOnly ? ' title="Auto-computed so this row totals 100%"' : ''}></td>`;
            }).join('')}
            <td><button type="button" class="recurring-remove-btn" data-gradient-remove-row="${rowIndex}">Remove</button></td>
          </tr>
        `).join('')}
      </tbody>
    `;

    tableEl.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', (event) => {
        const target = event.target;
        const rowIndex = Number(target.dataset.rowIndex || 0);
        const field = target.dataset.field;
        if (!rows[rowIndex]) rows[rowIndex] = { time: 0, values: {} };
        rows[rowIndex].values = rows[rowIndex].values || {};
        if (field === 'time') {
          rows[rowIndex].time = Number(target.value || 0);
        } else if (field !== firstLetter) {
          rows[rowIndex].values[field] = Number(target.value || 0);
          rows[rowIndex].values[firstLetter] = computeAutocompleteA(letters, rows[rowIndex].values);
          const firstInput = tableEl.querySelector(`input[data-row-index="${rowIndex}"][data-field="${firstLetter}"]`);
          if (firstInput) firstInput.value = rows[rowIndex].values[firstLetter];
        }
        mix.gradientRows = rows;
        updateRecurringCostTotal(questionId);
      });
    });

    tableEl.querySelectorAll('[data-gradient-remove-row]').forEach(button => {
      button.addEventListener('click', () => {
        const rowIndex = Number(button.dataset.gradientRemoveRow);
        if (rows.length <= 2) return;
        rows.splice(rowIndex, 1);
        mix.gradientRows = rows;
        renderGradientTable(questionId);
        updateRecurringCostTotal(questionId);
        updateHazardScore();
      });
    });

    const addRowButton = document.getElementById(`${ids.gradientTableWrapId}_add_row`);
    if (addRowButton) {
      addRowButton.onclick = () => {
        const last = rows[rows.length - 1] || { time: 0, values: {} };
        const nextTime = Number(last.time || 0) + 10;
        const values = Object.fromEntries(assignments.map(item => [item.letter, Number(last.values?.[item.letter] ?? item.entry.percent ?? 0)]));
        const newRow = { time: nextTime, values };
        newRow.values[firstLetter] = computeAutocompleteA(letters, newRow.values);
        rows.push(newRow);
        mix.gradientRows = rows;
        renderGradientTable(questionId);
        updateRecurringCostTotal(questionId);
      };
    }

    const mode = mix.gradientMode || 'isocratic';
    tableWrap.classList.toggle('hidden', mode !== 'gradient');
  }

  function assignmentsFromMix(mix) {
    return [...(mix.normalPhaseSolvents || []), ...(mix.reversePhaseSolvents || [])];
  }

  function getGradientCostBreakdown(questionId, flowRate) {
    syncGradientLetters(questionId);
    const mix = getRecurringMix(questionId);
    const solventEntries = assignmentsFromMix(mix);
    const letters = buildGradientAssignments(questionId).map(assignment => assignment.letter);
    const firstLetter = letters[0] || 'A';
    const water = solventEntries.find(entry => /water/i.test(String(entry.name || '')));
    const rows = normalizeGradientRows(mix.gradientRows).slice().sort((a, b) => a.time - b.time);
    rows.forEach(row => {
      row.values = row.values || {};
      row.values[firstLetter] = computeAutocompleteA(letters, row.values);
    });
    const breakdown = [];
    if (rows.length < 2 || !Number.isFinite(flowRate) || flowRate <= 0) return breakdown;

    for (let i = 0; i < rows.length - 1; i++) {
      const t1 = Number(rows[i].time);
      const t2 = Number(rows[i + 1].time);
      const duration = t2 - t1;
      if (!Number.isFinite(duration) || duration <= 0) {
        console.warn('[PharmaScore] Invalid gradient time interval:', { segment: i + 1, t1, t2 });
        continue;
      }
      const v1 = rows[i].values || {};
      const v2 = rows[i + 1].values || {};
      solventEntries.forEach(entry => {
        const c1 = Number(v1[entry.gradientLetter] ?? entry.percent ?? 0);
        const c2 = Number(v2[entry.gradientLetter] ?? entry.percent ?? 0);
        const avgPercent = (c1 + c2) / 2;
        const effectiveMin = duration * (avgPercent / 100);
        const volumeMl = effectiveMin * flowRate;
        const cost = volumeMl * Number(entry.price || 0) / 1000;
        breakdown.push({ segment: i + 1, component: entry.name, basis: 'mL', fromMin: t1, toMin: t2, durationMin: duration, avgPercent, effectiveMin, volumeMl, costEUR: Number(cost.toFixed(6)) });
      });
      const w1 = Number(v1[firstLetter] ?? (water && water.percent) ?? 0) / 100;
      const w2 = Number(v2[firstLetter] ?? (water && water.percent) ?? 0) / 100;
      const waterShare = water ? (w1 + w2) / 2 : 0;
      const aqueousVolumeL = (duration * waterShare * flowRate) / 1000;
      [...(mix.buffers || []), ...(mix.modifiers || [])].forEach(entry => {
        const mgPerL = Number(entry.amountMgPerL ?? entry.percent ?? 0);
        const cost = aqueousVolumeL * mgPerL / 1000 * Number(entry.price || 0);
        breakdown.push({ segment: i + 1, component: entry.name, basis: 'mg/L in aqueous phase', fromMin: t1, toMin: t2, durationMin: duration, concentration: mgPerL, volumeMl: duration * flowRate, costEUR: Number(cost.toFixed(6)) });
      });
    }
    return breakdown;
  }

  function calculateGradientCost(questionId, flowRate) {
    const validation = validateGradientProfile(questionId, flowRate);
    if (!validation.valid) {
      console.warn('[PharmaScore] Gradient profile is incomplete:', validation.errors);
      return 0;
    }
    return getGradientCostBreakdown(questionId, flowRate).reduce((sum, item) => sum + item.costEUR, 0);
  }

  function validateGradientProfile(questionId, flowRate) {
    const mix = getRecurringMix(questionId);
    const entries = assignmentsFromMix(mix);
    const letters = buildGradientAssignments(questionId).map(assignment => assignment.letter);
    const firstLetter = letters[0] || 'A';
    const rows = normalizeGradientRows(mix.gradientRows).slice().sort((a, b) => a.time - b.time);
    const errors = [];
    if (!Number.isFinite(flowRate) || flowRate <= 0) errors.push('Enter a positive gradient flow rate.');
    if (!entries.length) errors.push('Add at least one solvent before calculating a gradient.');
    if (rows.length < 2) errors.push('Add at least two time points (start and end) for the gradient.');
    rows.forEach((row, index) => {
      const t = Number(row.time);
      if (!Number.isFinite(t) || t < 0) errors.push(`Time point ${index + 1} must be a non-negative number.`);
      if (index > 0 && t <= Number(rows[index - 1].time)) errors.push(`Time points must be strictly increasing (row ${index + 1}).`);
      const values = row.values || {};
      const sumOthers = letters.filter(letter => letter !== firstLetter)
        .reduce((sum, letter) => sum + Number(values[letter] ?? 0), 0);
      if (sumOthers > 100.01) errors.push(`Time point ${index + 1} non-first solvent percentages exceed 100%.`);
    });
    return { valid: errors.length === 0, errors };
  }

  function parseRecurringEntries(rawValue) {
    if (!rawValue) return [];
    if (typeof rawValue === 'string') {
      try {
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(rawValue) ? rawValue : [];
  }

  function renderRecurringList(questionId, category) {
    const ids = getRecurringCostIds(questionId);
    const mix = getRecurringMix(questionId);
    const listId = category === 'normal_phase_solvent' ? ids.normalPhaseListId : category === 'reverse_phase_solvent' ? ids.reversePhaseListId : category === 'modifier' ? ids.modifierListId : ids.bufferListId;
    const listEl = document.getElementById(listId);
    if (!listEl) return;

    let entries = [];
    if (category === 'normal_phase_solvent') entries = mix.normalPhaseSolvents || [];
    else if (category === 'reverse_phase_solvent') entries = mix.reversePhaseSolvents || [];
    else if (category === 'modifier') entries = mix.modifiers || [];
    else entries = mix.buffers || [];

    if (!entries.length) {
      listEl.innerHTML = '';
      const listBlock = listEl.closest('.recurring-cost-list-block');
      if (listBlock) listBlock.classList.add('hidden');
      return;
    }

    const listBlock = listEl.closest('.recurring-cost-list-block');
    if (listBlock) listBlock.classList.remove('hidden');
    const isGradient = mix.gradientMode === 'gradient';
    const isAqueousAdditive = category === 'buffer' || category === 'modifier';
    listEl.innerHTML = entries.map((entry, index) => {
      const prefix = (isAqueousAdditive || isGradient) ? '' : (entry.gradientLetter ? `${entry.gradientLetter} - ` : '');
      const detail = isAqueousAdditive
        ? ` (${Number(entry.amountMgPerL ?? entry.percent ?? 0)} mg/L in water)`
        : (!isGradient ? ` (${entry.percent}%)` : '');
      return `
      <div class="recurring-cost-entry">
        <span>${prefix}${entry.name}${detail}${entry.disclaimer ? ` <small>${entry.disclaimer}</small>` : ''}</span>
        <button type="button" class="recurring-remove-btn" data-question-id="${questionId}" data-category="${category}" data-index="${index}">Remove</button>
      </div>
    `;
    }).join('');

    listEl.querySelectorAll('.recurring-remove-btn').forEach(button => {
      button.addEventListener('click', () => {
        const idx = Number(button.dataset.index || 0);
        if (category === 'normal_phase_solvent') mix.normalPhaseSolvents.splice(idx, 1);
        else if (category === 'reverse_phase_solvent') mix.reversePhaseSolvents.splice(idx, 1);
        else if (category === 'modifier') mix.modifiers.splice(idx, 1);
        else mix.buffers.splice(idx, 1);
        mix.solvents = [...(mix.normalPhaseSolvents || []), ...(mix.reversePhaseSolvents || [])];
        syncGradientLetters(questionId);
        renderRecurringList(questionId, category);
        renderGradientTable(questionId);
        updateRecurringCostTotal(questionId);
      });
    });
  }

  function getAuxiliaryEquipmentOptions(questionId) {
    const categoryMap = {
      aux_pretreat_basic: 'Basic Sample Analysis',
      aux_pretreat_advanced: 'Advanced Sample Analysis',
      aux_pretreat_omics: 'Omics Sample Analysis',
      aux_pretreat_software: 'Software',
      sample_pretreat_solvent: 'Solvent used',
      sample_pretreat_reagent: 'Reagent used',
      sample_pretreat_materials: 'Sample prep materials'
    };
    const targetCategory = categoryMap[questionId] || 'Other';
    const source = questionId && String(questionId).startsWith('sample_pretreat_')
      ? (Array.isArray(window.SAMPLE_PRETREATMENT_EQUIPMENT_OPTIONS) ? window.SAMPLE_PRETREATMENT_EQUIPMENT_OPTIONS : [])
      : (Array.isArray(window.AUXILIARY_EQUIPMENT_OPTIONS) ? window.AUXILIARY_EQUIPMENT_OPTIONS : []);
    return source.filter(item => {
      const itemCategory = String(item.category || item.group || item.section || 'Other');
      return itemCategory === targetCategory;
    });
  }

  function isSamplePretreatmentChecklist(questionId) {
    return String(questionId || '').startsWith('sample_pretreat_');
  }

  function getSamplePretreatmentAmountLabel(questionId, unit) {
    if (questionId === 'sample_pretreat_solvent') return 'Volume (mL per sample)';
    if (questionId === 'sample_pretreat_reagent') return 'Weight (g per sample)';
    if (unit) return `Amount (${unit} per sample)`;
    return 'Amount (per sample)';
  }

  function renderChecklistOtherControls(questionId, isSamplePretreatment, unit) {
    const lookupUnit = unit === 'mL' ? 'ml' : unit === 'g' ? 'g' : 'item';
    return `
      <div class="checklist-other-controls" data-checklist-other="${questionId}" data-unit="${lookupUnit}" data-sample="${isSamplePretreatment ? 'true' : 'false'}">
        <button type="button" class="checklist-other-add-btn">Add other</button>
        <button type="button" class="recurring-add-btn checklist-other-query-all hidden">Query all</button>
        <div class="checklist-other-rows"></div>
        <small class="checklist-other-limit">Up to 5 additional items.</small>
      </div>`;
  }

  function addChecklistOtherRow(questionId) {
    const controls = document.querySelector(`[data-checklist-other="${questionId}"]`);
    if (!controls) return;
    const rows = controls.querySelector('.checklist-other-rows');
    if (!rows || rows.children.length >= 5) return;
    const row = document.createElement('div');
    row.className = 'checklist-other-row';
    row.innerHTML = `
      <input type="text" class="form-input checklist-other-name" placeholder="Name of item">
      <input type="number" min="0" step="any" class="form-input checklist-other-price hidden" placeholder="Price (EUR)">
      <button type="button" class="recurring-remove-btn checklist-other-remove">Remove</button>
      <small class="checklist-other-message" aria-live="polite"></small>`;
    rows.appendChild(row);
    const queryAll = controls.querySelector('.checklist-other-query-all');
    if (queryAll) queryAll.classList.remove('hidden');
    const price = row.querySelector('.checklist-other-price');
    price.addEventListener('input', () => {
      const name = row.querySelector('.checklist-other-name').value.trim();
      const value = Number(price.value);
      if (name && Number.isFinite(value) && value > 0) addChecklistOtherItem(questionId, name, value, controls.dataset.sample === 'true');
    });
    row.querySelector('.checklist-other-remove').addEventListener('click', () => {
      row.remove();
      if (!rows.children.length && queryAll) queryAll.classList.add('hidden');
    });
  }

  async function queryChecklistOtherItems(questionId) {
    const controls = document.querySelector(`[data-checklist-other="${questionId}"]`);
    if (!controls) return;
    const rows = Array.from(controls.querySelectorAll('.checklist-other-row'));
    const queryButton = controls.querySelector('.checklist-other-query-all');
    const unit = controls.dataset.unit || 'item';
    if (!rows.length) return;
    queryButton.disabled = true;
    for (const row of rows) {
      const name = row.querySelector('.checklist-other-name').value.trim();
      const price = row.querySelector('.checklist-other-price');
      const message = row.querySelector('.checklist-other-message');
      if (!name) {
        message.textContent = 'Enter a name before querying.';
        continue;
      }
      message.textContent = 'Querying price...';
      const result = await window.lookupChemicalPrice(name, 'US', unit, document.getElementById(`${questionId}_label`)?.textContent || questionId);
      price.classList.remove('hidden');
      if (!result.success) {
        message.textContent = result.error || 'No reliable estimate found. Enter a price manually.';
        continue;
      }
      price.value = String(result.price);
      message.textContent = `${result.disclaimer || 'AI-estimated price. Verify before relying on it.'} You can edit the price.`;
      addChecklistOtherItem(questionId, name, Number(result.price), controls.dataset.sample === 'true');
    }
    queryButton.disabled = false;
  }

  function addChecklistOtherItem(questionId, name, price, isSamplePretreatment, amount = 1) {
    const list = document.getElementById(`${questionId}_equipment_list`);
    if (!list || !name || !Number.isFinite(price) || price <= 0) return;
    const existing = Array.from(list.querySelectorAll('input[type="checkbox"]')).find(box => box.value.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.checked = true;
      updateEquipmentChecklistTotal(questionId);
      syncCustomChecklistAnswers(questionId);
      return;
    }
    const slug = `${name}_${Date.now()}`.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const optionId = `${questionId}_other_${slug}`;
    const amountInputId = `${optionId}_amount`;
    const unit = isSamplePretreatment ? (questionId === 'sample_pretreat_solvent' ? 'mL' : questionId === 'sample_pretreat_reagent' ? 'g' : 'item') : 'item';
    const wrapper = document.createElement('div');
    wrapper.className = 'equipment-check-item-wrap';
    wrapper.dataset.customOther = 'true';
    wrapper.innerHTML = `
      <label class="equipment-check-item" for="${optionId}">
        <input id="${optionId}" type="checkbox" value="${name.replace(/"/g, '&quot;')}" data-price="${price}" data-amount-input-id="${amountInputId}" checked>
        <span class="equipment-check-name">${name} (Other)</span>
      </label>
      ${isSamplePretreatment ? `<div class="sample-pretreat-amount-row"><label for="${amountInputId}" class="input-label-small">${getSamplePretreatmentAmountLabel(questionId, unit)}</label><input id="${amountInputId}" type="number" min="0" step="any" class="form-input sample-pretreat-amount-input" value="${Number(amount) || 1}"></div>` : ''}`;
    list.appendChild(wrapper);
    const checkbox = wrapper.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => updateEquipmentChecklistTotal(questionId));
    const amountInput = wrapper.querySelector('.sample-pretreat-amount-input');
    if (amountInput) amountInput.addEventListener('input', () => {
      updateEquipmentChecklistTotal(questionId);
      updateHazardScore();
    });
    updateEquipmentChecklistTotal(questionId);
    syncCustomChecklistAnswers(questionId);
    updateHazardScore();
  }

  function syncCustomChecklistAnswers(questionId) {
    const list = document.getElementById(`${questionId}_equipment_list`);
    if (!list) return;
    const customItems = Array.from(list.querySelectorAll('[data-custom-other="true"]')).map(wrapper => {
      const checkbox = wrapper.querySelector('input[type="checkbox"]');
      const amount = wrapper.querySelector('.sample-pretreat-amount-input');
      return {
        name: checkbox?.value || '',
        price: Number(checkbox?.dataset.price || 0),
        amount: amount ? Number(amount.value || 0) : 1
      };
    }).filter(item => item.name);
    ANSWERS[`${questionId}_other_items`] = JSON.stringify(customItems);
  }

  function updateEquipmentChecklistTotal(questionId) {
    const list = document.getElementById(questionId + '_equipment_list');
    const totalEl = document.getElementById(questionId + '_total');
    const scoreEl = document.getElementById(questionId + '_score');
    if (!list || !totalEl) return;
    const isSamplePretreatment = isSamplePretreatmentChecklist(questionId);
    const checked = Array.from(list.querySelectorAll('input[type="checkbox"]:checked'));
    let hasMissingAmounts = false;
    const total = checked.reduce((sum, cb) => {
      const price = Number(cb.getAttribute('data-price') || 0);
      if (!isSamplePretreatment) return sum + price;
      const amountInputId = cb.getAttribute('data-amount-input-id');
      const amountEl = amountInputId ? document.getElementById(amountInputId) : null;
      const amount = amountEl && amountEl.value !== '' ? Number(amountEl.value) : NaN;
      if (!Number.isFinite(amount) || amount <= 0) {
        hasMissingAmounts = true;
        return sum;
      }
      const solventPerLitre = questionId === 'sample_pretreat_solvent';
      return sum + (price * amount * (solventPerLitre ? 1 / 1000 : 1));
    }, 0);

    if (isSamplePretreatment && (checked.length === 0 || hasMissingAmounts)) {
      totalEl.value = '';
      if (scoreEl) scoreEl.textContent = '0';
      delete ANSWERS[questionId];
      delete ANSWERS[questionId + '_total'];
      return;
    }

    totalEl.value = String(total.toFixed(2));
    const question = QUESTION_AREAS.flatMap(area => area.questions || []).find(item => item.id === questionId);
    let score = 0;
    try {
      const params = question && typeof question.params === 'object' ? question.params : JSON.parse((question && question.params) || '{}');
      score = getQuestionThresholdScore(questionId, total);
    } catch {
      score = 0;
    }
    if (scoreEl) scoreEl.textContent = `Score: ${score}/100`;
    ANSWERS[questionId] = String(total.toFixed(2));
    ANSWERS[questionId + '_total'] = String(total.toFixed(2));
  }

  function addRecurringEntry(questionId, category) {
    const ids = getRecurringCostIds(questionId);
    const mix = getRecurringMix(questionId);
    const selectId = category === 'normal_phase_solvent' ? ids.normalPhaseSelectId : category === 'reverse_phase_solvent' ? ids.reversePhaseSelectId : category === 'modifier' ? ids.modifierSelectId : ids.bufferSelectId;
    const pctId = category === 'normal_phase_solvent' ? ids.normalPhasePctId : category === 'reverse_phase_solvent' ? ids.reversePhasePctId : category === 'modifier' ? ids.modifierPctId : ids.bufferPctId;
    const selectEl = document.getElementById(selectId);
    const pctEl = document.getElementById(pctId);
    const isGradientMode = (getRecurringMix(questionId).gradientMode || 'isocratic') === 'gradient';
    const isAqueousAdditive = category === 'buffer' || category === 'modifier';
    if (!selectEl || !selectEl.value) {
      showRecurringCostMessage(questionId, 'Please choose an option before adding it to the list.', 'error');
      return;
    }

    const percent = (isAqueousAdditive || !isGradientMode) ? Number(pctEl && pctEl.value !== '' ? pctEl.value : 0) : 0;
    if ((isAqueousAdditive || !isGradientMode) && (!Number.isFinite(percent) || percent <= 0)) {
      showRecurringCostMessage(questionId, isAqueousAdditive ? 'Please enter a valid amount (mg/L in water) greater than zero.' : 'Please enter a valid percentage greater than zero.', 'error');
      return;
    }

    const selectedOption = selectEl.selectedOptions && selectEl.selectedOptions[0] ? selectEl.selectedOptions[0] : null;
    const isOther = selectEl.value === '__other__';
    const otherIds = getOtherLookupIds(`${questionId}_${category}`);
    const otherName = document.getElementById(otherIds.nameId)?.value.trim() || '';
    const otherPrice = Number(document.getElementById(otherIds.priceId)?.value || 0);
    const name = isOther ? otherName : (selectedOption ? (selectedOption.textContent || selectedOption.value) : selectEl.value);
    const price = isOther ? otherPrice : (Number(selectedOption ? (selectedOption.getAttribute('data-price') || 0) : 0) || 0);
    if (isOther && (!name || !Number.isFinite(price) || price < 0)) {
      showRecurringCostMessage(questionId, 'Query a price for the Other item before adding it.', 'error');
      return;
    }
    const allSolventEntries = [...(mix.normalPhaseSolvents || []), ...(mix.reversePhaseSolvents || [])];
    const duplicateExists = allSolventEntries.some(entry => normalizeRecurringEntryName(entry.name) === normalizeRecurringEntryName(name));
    if (duplicateExists && (category === 'normal_phase_solvent' || category === 'reverse_phase_solvent')) {
      showRecurringCostMessage(questionId, 'This solvent has already been added. Please choose a different one.', 'error');
      return;
    }

    if (category === 'buffer') {
      const waterEntry = [...(mix.reversePhaseSolvents || [])].find(entry => /water/i.test(String(entry.name || '')));
      if (!waterEntry) {
        showRecurringCostMessage(questionId, 'A buffer cannot be added unless water is already in the reverse phase list.', 'error');
        return;
      }
    }

    const waterEntryInReversePhase = [...(mix.reversePhaseSolvents || [])].find(entry => /water/i.test(String(entry.name || '')));
    const waterShare = waterEntryInReversePhase ? Number(waterEntryInReversePhase.percent || 0) / 100 : 1;

    const entry = {
      id: `${category}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name,
      percent,
      amountMgPerL: (category === 'buffer' || category === 'modifier') ? percent : 0,
      price,
      disclaimer: isOther ? (document.getElementById(otherIds.messageId)?.textContent || 'AI-estimated price. Verify before relying on it.') : '',
      gradientLetter: '',
      cost: (category === 'buffer' || category === 'modifier')
        ? price * percent * waterShare / 1000000
        : price * (percent / 100) / 1000
    };

    if (category === 'normal_phase_solvent') {
      mix.normalPhaseSolvents.push(entry);
    } else if (category === 'reverse_phase_solvent') {
      mix.reversePhaseSolvents.push(entry);
    } else if (category === 'modifier') {
      mix.modifiers.push(entry);
    } else {
      mix.buffers.push(entry);
    }

    syncGradientLetters(questionId);
    mix.solvents = [...(mix.normalPhaseSolvents || []), ...(mix.reversePhaseSolvents || [])];
    clearRecurringCostMessage(questionId);
    renderRecurringList(questionId, category);
    renderGradientTable(questionId);
    updateRecurringCostTotal(questionId);
    updateHazardScore();
  }

  function updateRecurringCostTotal(questionId) {
    const ids = getRecurringCostIds(questionId);
    const runEl = document.getElementById(ids.runId);
    const flowEl = document.getElementById(ids.flowId);
    const totalEl = document.getElementById(ids.totalId);
    const mix = getRecurringMix(questionId);
    const runTime = Number(runEl && runEl.value !== '' ? runEl.value : 0) || 0;
    const flowRate = Number(flowEl && flowEl.value !== '' ? flowEl.value : 0) || 0;
    const entries = [...(mix.normalPhaseSolvents || []), ...(mix.reversePhaseSolvents || []), ...(mix.modifiers || []), ...(mix.buffers || [])];
    const waterEntry = [...(mix.reversePhaseSolvents || [])].find(entry => /water/i.test(String(entry.name || '')));
    const waterShare = waterEntry ? Number(waterEntry.percent || 0) / 100 : 1;
    const solventCostPerMl = [...(mix.normalPhaseSolvents || []), ...(mix.reversePhaseSolvents || [])]
      .reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
    const aqueousAdditiveCostPerMl = [...(mix.buffers || []), ...(mix.modifiers || [])]
      .reduce((sum, entry) => sum + (Number(entry.price || 0) * Number(entry.amountMgPerL ?? entry.percent ?? 0) * waterShare / 1000000), 0);
    let total = (solventCostPerMl + aqueousAdditiveCostPerMl) * runTime * flowRate;
    if (mix.gradientMode === 'gradient') {
      const gradientFlow = Number(document.getElementById(ids.gradientFlowId)?.value || 0) || 0;
      total = calculateGradientCost(questionId, gradientFlow);
    }

    if (totalEl) totalEl.value = Number.isFinite(total) ? String(total.toFixed(2)) : '0';
    const scoreOutput = document.getElementById(`${questionId}_score_output`);
    if (scoreOutput) scoreOutput.textContent = `Score: ${getQuestionThresholdScore(questionId, total)}/100`;
    if (mix.gradientMode === 'gradient') {
      console.groupCollapsed(`[PharmaScore] Gradient cost calculation: ${questionId}`);
      console.table(getGradientCostBreakdown(questionId, Number(document.getElementById(ids.gradientFlowId)?.value || 0) || 0));
      console.log('Gradient total (EUR):', total);
      console.groupEnd();
    }
    ANSWERS[questionId] = totalEl && totalEl.value ? totalEl.value : '';
    ANSWERS[questionId + '_total'] = totalEl && totalEl.value ? totalEl.value : '';
    if (typeof window.updateCurrentSectionScore === 'function') window.updateCurrentSectionScore();
  }

  function updateHazardScore() {
    const totalEl = document.getElementById('green2');
    const findSolventReference = (name, includeSampleCatalog = false) => {
      const catalogs = includeSampleCatalog
        ? [SOLVENT_OPTIONS || [], SAMPLE_PRETREATMENT_EQUIPMENT_OPTIONS || []]
        : [SOLVENT_OPTIONS || []];
      const normalized = normalizeRecurringEntryName(name);
      for (const catalog of catalogs) {
        const exact = catalog.find(item => normalizeRecurringEntryName(item.name) === normalized);
        if (exact) return exact;
      }
      const compactName = normalized.replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '');
      for (const catalog of catalogs) {
        const match = catalog.find(item => {
          const compactItem = normalizeRecurringEntryName(item.name).replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '');
          return compactItem && compactName && (compactItem.includes(compactName) || compactName.includes(compactItem));
        });
        if (match) return match;
      }
      return null;
    };
    const parseSavedEntries = key => {
      try {
        const parsed = JSON.parse(ANSWERS[key] || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    const mix = getRecurringMix('econ_rec1');
    if (!mix.normalPhaseSolvents.length && !mix.reversePhaseSolvents.length) {
      mix.normalPhaseSolvents = parseSavedEntries('econ_rec1_normal_phase_solvent_entries');
      mix.reversePhaseSolvents = parseSavedEntries('econ_rec1_reverse_phase_solvent_entries');
    }
    if (!mix.gradientRows || !mix.gradientRows.length) {
      mix.gradientRows = normalizeGradientRows(parseSavedEntries('econ_rec1_gradient_rows'));
    }
    if (!mix.gradientMode && ANSWERS.econ_rec1_gradient_mode) {
      mix.gradientMode = ANSWERS.econ_rec1_gradient_mode;
    }
    const runTime = Number(document.getElementById('econ_rec1_run')?.value || ANSWERS.econ_rec1_run || 0) || 0;
    const flowRate = Number(document.getElementById('econ_rec1_flow')?.value || ANSWERS.econ_rec1_flow || 0) || 0;
    const gradientFlowRate = Number(document.getElementById('econ_rec1_gradient_flow')?.value || ANSWERS.econ_rec1_gradient_flow || 0) || 0;
    syncGradientLetters('econ_rec1');
    const solventEntries = [...(mix.normalPhaseSolvents || []), ...(mix.reversePhaseSolvents || [])];
    const solventVolumes = new Map();
    if (mix.gradientMode === 'gradient' && gradientFlowRate > 0) {
      const rows = normalizeGradientRows(mix.gradientRows).slice().sort((a, b) => a.time - b.time);
      for (let index = 0; index < rows.length - 1; index += 1) {
        const duration = Number(rows[index + 1].time) - Number(rows[index].time);
        if (!Number.isFinite(duration) || duration <= 0) continue;
        const firstValues = rows[index].values || {};
        const secondValues = rows[index + 1].values || {};
        solventEntries.forEach(entry => {
          const firstPercent = Number(firstValues[entry.gradientLetter] ?? entry.percent ?? 0);
          const secondPercent = Number(secondValues[entry.gradientLetter] ?? entry.percent ?? 0);
          const averagePercent = (firstPercent + secondPercent) / 2;
          const volumeMl = duration * gradientFlowRate * averagePercent / 100;
          solventVolumes.set(entry.name, (solventVolumes.get(entry.name) || 0) + volumeMl);
        });
      }
    } else {
      solventEntries.forEach(entry => {
        solventVolumes.set(entry.name, runTime * flowRate * Number(entry.percent || 0) / 100);
      });
    }
    let hazard = 0;
    const details = [];
    solventEntries.forEach(entry => {
      const reference = findSolventReference(entry.name);
      const volumeMl = solventVolumes.get(entry.name) || 0;
      const nfpa = Number(reference?.nfpa ?? entry.nfpa ?? 0);
      hazard += nfpa * volumeMl;
      details.push({ source: 'mobile phase', solvent: entry.name, nfpa, volumeMl, hazard: nfpa * volumeMl });
    });
    const sampleList = document.getElementById('sample_pretreat_solvent_equipment_list');
    sampleList?.querySelectorAll('input[type="checkbox"]:checked').forEach(box => {
      const amount = Number(document.getElementById(box.dataset.amountInputId)?.value || 0) || 0;
      const reference = findSolventReference(box.value, true);
      const nfpa = Number(reference?.nfpa ?? 0);
      hazard += nfpa * amount;
      details.push({ source: 'sample pretreatment', solvent: box.value, nfpa, volumeMl: amount, hazard: nfpa * amount });
    });
    const hazardValue = hazard.toFixed(2);
    if (totalEl) totalEl.value = hazardValue;
    ANSWERS.green2 = hazardValue;
    ANSWERS.green2_total = hazardValue;
    console.table(details);
    console.log('[PharmaScore] NFPA hazard score:', hazard);
  }

  function populateColumnNames(questionId, selectedType, ids = getColumnSelectorIds(questionId)) {
    const nameEl = document.getElementById(ids.columnNameId);
    if (!nameEl) return;

    const filtered = (Array.isArray(COLUMN_OPTIONS) ? COLUMN_OPTIONS : []).filter(column => String(column.type) === String(selectedType));
    const currentValue = nameEl.value;
    nameEl.innerHTML = '<option value="">Select column name...</option>' + filtered.map(column => `<option value="${String(column.fullName).replace(/"/g, '&quot;')}" data-price="${Number(column.price || 0)}">${column.fullName}</option>`).join('');

    if (filtered.length && currentValue && filtered.some(column => String(column.fullName) === String(currentValue))) {
      nameEl.value = currentValue;
    } else if (filtered.length) {
      nameEl.value = filtered[0].fullName;
    }

    updateColumnSelectorTotal(questionId, ids);
  }

  function updateColumnSelectorTotal(questionId, ids = getColumnSelectorIds(questionId)) {
    const typeEl = document.getElementById(ids.columnTypeId);
    const nameEl = document.getElementById(ids.columnNameId);
    const totalEl = document.getElementById(ids.totalId);
    if (!nameEl || !typeEl) return;

    const selectedType = typeEl.value;
    const selectedName = nameEl.value;
    const selected = (Array.isArray(COLUMN_OPTIONS) ? COLUMN_OPTIONS : []).find(column => String(column.type) === String(selectedType) && String(column.fullName) === String(selectedName));
    const otherPrice = Number(document.getElementById(getOtherLookupIds(questionId).priceId)?.value || 0);
    const price = selectedType === '__other__' ? otherPrice : (Number(selected && selected.price ? selected.price : 0) || 0);

    if (selectedType === '__other__' && (!Number.isFinite(price) || price <= 0)) {
      delete ANSWERS[questionId];
      delete ANSWERS[questionId + '_total'];
      return;
    }

    if (totalEl) totalEl.value = String(price.toFixed(2));
    const scoreOutput = document.getElementById(`${questionId}_score_output`);
    if (scoreOutput) scoreOutput.textContent = `Score: ${getQuestionThresholdScore(questionId, price)}/100`;
    ANSWERS[questionId] = String(price);
    ANSWERS[questionId + '_total'] = String(price);
    ANSWERS[questionId + '_name'] = selectedType === '__other__' ? (nameEl.dataset.otherName || '') : (selectedName || '');
  }

  function renderQuestions() {
    const form = document.getElementById('assessment-form');
    if (!form) return;
    form.innerHTML = '';
    const area = QUESTION_AREAS[currentTab];
    renderFixedCostSubTabs();
    const questionsToRender = getQuestionsForCurrentView(area);

    questionsToRender.forEach(q => {
      if (q.type === 'label') {
        if (q.id === 'equip_section3') return;
        if (q.id === 'sample_analysis_results_heading') {
          form.innerHTML += `<div class="form-section-title-only">${q.text || ''}</div>`;
          return;
        }
        const labelIconKey = iconKeyFromText(q.id || q.text || 'section');
        form.innerHTML += `<div class="form-label-block"><span class="label-icon-slot" data-icon-key="${labelIconKey}" aria-hidden="true"></span><div class="form-label-block-copy">${q.text || ''}</div></div>`;
        return;
      }
      const isConditional = q.show_if_id && q.show_if_value;
      const isVisible = shouldShowQuestion(q);
      let input = '';

      if (q.type === 'dropdown') {
        const opts = typeof q.options === 'string' ? q.options.split(';') : q.options;
        input = `<select id="${q.id}" name="${q.id}" class="form-input" required><option value="">Select...</option>${opts.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
      } else if (q.type === 'csv_dropdown') {
        const params = typeof q.params === 'string' ? (() => { try { return JSON.parse(q.params); } catch { return {}; } })() : (q.params || {});
        const sourceKey = params.source || 'SAMPLE_ANALYSIS_RESULTS_OPTIONS';
        const sourceItems = Array.isArray(window[sourceKey]) ? window[sourceKey] : [];
        const valueField = params.valueField || 'value';
        const labelField = params.labelField || 'label';
        const options = sourceItems.map(item => {
          const sampleName = item && (item.sample !== undefined ? item.sample : (item.matrix || item.substrate || item.name || ''));
          const difficulty = item && (item.difficulty !== undefined && item.difficulty !== null ? item.difficulty : (item.score || item.value || ''));
          const rawValue = item && (item[valueField] !== undefined && item[valueField] !== null ? item[valueField] : item.value);
          const labelFromData = item && (item[labelField] !== undefined && item[labelField] !== null ? item[labelField] : `${sampleName}${difficulty !== '' && difficulty !== undefined && difficulty !== null ? ` ${difficulty}` : ''}`);
          const label = labelFromData || `${sampleName}${difficulty !== '' && difficulty !== undefined && difficulty !== null ? ` ${difficulty}` : ''}`;
          return { value: String(rawValue ?? difficulty ?? sampleName), label: String(label) };
        }).filter(item => item.value !== 'undefined' && item.label !== 'undefined' && item.value !== '' && item.label !== '');
        input = `<select id="${q.id}" name="${q.id}" class="form-input" required><option value="">Select...</option>${options.map(opt => `<option value="${String(opt.value)}">${String(opt.label)}</option>`).join('')}</select>`;
      } else if (q.type === 'boolean') {
        input = `
          <div class="boolean-group" role="radiogroup" aria-labelledby="${q.id}_label">
            <label class="boolean-option" for="${q.id}_true">
              <input id="${q.id}_true" name="${q.id}" type="radio" value="true" data-boolean-id="${q.id}">
              <span>True</span>
            </label>
            <label class="boolean-option" for="${q.id}_false">
              <input id="${q.id}_false" name="${q.id}" type="radio" value="false" data-boolean-id="${q.id}">
              <span>False</span>
            </label>
          </div>
        `;
      } else if (q.type === 'number') {
        const unitLabel = formatUnitLabel(getQuestionDisplayUnit(q));
        const readOnlyHazard = q.id === 'green2';
        input = `<div class="number-input-wrapper"><input id="${q.id}" name="${q.id}" type="number" min="0" step="any" class="form-input" ${readOnlyHazard ? 'readonly' : 'required'}><span class="unit-label">${unitLabel}</span></div>`;
      } else if (q.type === 'text') {
        input = `<input id="${q.id}" name="${q.id}" type="text" class="form-input" required>`;
      } else if (q.type === 'equipment_dropdown') {
        const ids = getEquipmentDropdownIds(q.id);
        const instrumentTypes = [...new Set((Array.isArray(INSTRUMENT_OPTIONS) ? INSTRUMENT_OPTIONS : []).map(inst => inst.type || 'Other'))].sort();
        const typeOptionsHtml = instrumentTypes.map(type => `<option value="${String(type).replace(/"/g, '&quot;')}">${String(type)}</option>`).join('') + '<option value="__other__">Other</option>';
        input = `
          <div class="equipment-dropdown-wrap" id="${ids.wrapperId}">
            <div class="recurring-cost-grid">
              <div class="recurring-cost-field">
                <label for="${ids.typeId}" class="input-label-small">Instrument type</label>
                <select id="${ids.typeId}" name="${ids.typeId}" class="form-input" required>
                  <option value="">Select type...</option>
                  ${typeOptionsHtml}
                </select>
              </div>
              <div class="recurring-cost-field">
                <label for="${ids.nameId}" class="input-label-small">Primary instrument</label>
                <select id="${ids.nameId}" name="${ids.nameId}" class="form-input" required>
                  <option value="">Select instrument...</option>
                </select>
              </div>
            </div>
            ${renderOtherLookupControls(q.id, 'item')}
            <div class="chem-lookup-total-section">
              <span id="${q.id}_score_output" class="question-score-output">Score: 0/100</span>
              <input id="${ids.totalId}" name="${ids.totalId}" type="hidden">
            </div>
          </div>
        `;
      } else if (q.type === 'equipment_checklist') {
        const equipmentOptions = getAuxiliaryEquipmentOptions(q.id);
        const isSamplePretreatment = isSamplePretreatmentChecklist(q.id);
        const checklistUnit = q.id === 'sample_pretreat_solvent' ? 'mL' : q.id === 'sample_pretreat_reagent' ? 'g' : 'item';
        const equipmentList = equipmentOptions.length ? equipmentOptions.map(item => {
          const optionSlug = String(item.name).replace(/[^a-z0-9]+/gi, '_').toLowerCase();
          const optionId = `${q.id}_${optionSlug}`;
          const amountInputId = `${optionId}_amount`;
          const amountRowId = `${optionId}_amount_row`;
          const unit = String(item.unit || '').trim();
          const amountLabel = getSamplePretreatmentAmountLabel(q.id, unit);
          return `
          <div class="equipment-check-item-wrap">
            <label class="equipment-check-item" for="${optionId}">
              <input id="${optionId}" type="checkbox" value="${String(item.name).replace(/"/g, '&quot;')}" data-price="${Number(item.price || 0)}" data-amount-input-id="${amountInputId}">
              <span class="equipment-check-name">${String(item.name)}</span>
            </label>
            ${isSamplePretreatment ? `
            <div id="${amountRowId}" class="sample-pretreat-amount-row hidden">
              <label for="${amountInputId}" class="input-label-small">${amountLabel}</label>
              <input id="${amountInputId}" type="number" min="0" step="any" class="form-input sample-pretreat-amount-input" data-parent-checkbox-id="${optionId}" placeholder="0">
            </div>` : ''}
          </div>`;
        }).join('') : '<div class="equipment-empty">No auxiliary equipment loaded for this section.</div>';
          const isFirstChecklistOpen = false;
        input = `
          <div class="equipment-checklist-wrap">
            <button type="button" class="equipment-checklist-toggle ${isFirstChecklistOpen ? 'is-open' : ''}" data-target="${q.id}_equipment_panel" aria-expanded="${isFirstChecklistOpen ? 'true' : 'false'}">
              <span>${q.text || q.id}</span>
            </button>
            <div id="${q.id}_equipment_panel" class="equipment-checklist-panel ${isFirstChecklistOpen ? '' : 'hidden'}">
              <div id="${q.id}_equipment_list" class="equipment-checklist-list">${equipmentList}</div>
              ${renderChecklistOtherControls(q.id, isSamplePretreatment, checklistUnit)}
              <div id="${q.id}_equipment_empty" class="equipment-empty hidden">No instruments were loaded from the auxiliary equipment CSV.</div>
              <div class="chem-lookup-total-section">
                <label for="${q.id}_score" class="input-label-small">${isSamplePretreatment ? 'Total sample pretreatment score' : 'Total auxiliary equipment score'}</label>
                <output id="${q.id}_score" class="question-score-output">Score: 0/100</output>
                <input id="${q.id}_total" name="${q.id}_total" type="hidden">
              </div>
            </div>
          </div>
        `;
      } else if (q.type === 'column_selector') {
        const ids = getColumnSelectorIds(q.id);
        input = `
          <div class="column-selector-wrap" id="${ids.wrapperId}">
            <div class="recurring-cost-grid">
              <div class="recurring-cost-field">
                <label id="${q.id}_column_type_label" for="${ids.columnTypeId}" class="input-label-small">Column Type</label>
                ${renderSimpleSelect(ids.columnTypeId, getColumnTypes(COLUMN_OPTIONS), 'Select type').replace('</select>', '<option value="__other__">Other</option></select>')}
              </div>
              <div class="recurring-cost-field">
                <label id="${q.id}_column_label" for="${ids.columnNameId}" class="input-label-small">Full column characteristics</label>
                <select id="${ids.columnNameId}" name="${ids.columnNameId}" class="form-input" required>
                  <option value="">Select column name...</option>
                </select>
              </div>
            </div>
            ${renderOtherLookupControls(q.id, 'item')}
            <div class="chem-lookup-total-section">
              <span id="${q.id}_score_output" class="question-score-output">Score: 0/100</span>
              <input id="${ids.totalId}" name="${ids.totalId}" type="hidden">
            </div>
          </div>
        `;
      } else if (q.type === 'recurring_cost_calculator') {
        const ids = getRecurringCostIds(q.id);
        const solvents = Array.isArray(SOLVENT_OPTIONS) ? SOLVENT_OPTIONS : [];
        const buffers = Array.isArray(BUFFER_OPTIONS) ? BUFFER_OPTIONS : [];
        const normalOptionsHtml = renderGroupedSelectOptions(solvents.filter(item => String(item.phase || '').toLowerCase() === 'normal'));
        const reverseOptionsHtml = renderGroupedSelectOptions(solvents.filter(item => String(item.phase || '').toLowerCase() === 'reverse'));
        const bufferOptionsHtml = renderGroupedSelectOptions(buffers.filter(item => String(item.phase || '').toLowerCase() !== 'modifier'));
        const modifierOptionsHtml = renderGroupedSelectOptions(buffers.filter(item => String(item.phase || '').toLowerCase() === 'modifier'));

        input = `
          <div class="recurring-cost-calc" id="${q.id}_calculator">
            <div class="recurring-cost-grid ${getRecurringMix(q.id).gradientMode === 'gradient' ? 'hidden' : ''}" data-gradient-runtime-fields="true">
              <div class="recurring-cost-field">
                <label for="${ids.runId}" class="input-label-small">Run time (min)</label>
                <input id="${ids.runId}" name="${ids.runId}" type="number" min="0" step="any" class="form-input" placeholder="e.g. 30">
              </div>
              <div class="recurring-cost-field">
                <label for="${ids.flowId}" class="input-label-small">Flow rate (mL/min)</label>
                <input id="${ids.flowId}" name="${ids.flowId}" type="number" min="0" step="any" class="form-input" placeholder="e.g. 1.2">
              </div>
            </div>

            <div class="recurring-mode-toggle" aria-label="Analytical mode selector">
              <span class="toggle-label">Mode</span>
              <label class="toggle-option">
                <input type="radio" name="${ids.modeGroupName}" value="isocratic" id="${ids.isocraticModeId}" checked>
                <span>Isocratic</span>
              </label>
              <label class="toggle-option">
                <input type="radio" name="${ids.modeGroupName}" value="gradient" id="${ids.gradientModeId}">
                <span>Gradient</span>
              </label>
            </div>
            <div id="${ids.messageId}" class="recurring-cost-message hidden" aria-live="polite"></div>

            <div class="recurring-cost-grid">
              <div class="recurring-cost-field">
                <label for="${ids.normalPhaseSelectId}" class="input-label-small">Normal phase solvent</label>
                <select id="${ids.normalPhaseSelectId}" name="${ids.normalPhaseSelectId}" class="form-input">
                  <option value="">Select solvent...</option>
                  ${normalOptionsHtml}
                </select>
              </div>
              <div class="recurring-cost-field ${getRecurringMix(q.id).gradientMode === 'gradient' ? 'hidden' : ''}">
                <label for="${ids.normalPhasePctId}" class="input-label-small">Percent (%)</label>
                <input id="${ids.normalPhasePctId}" name="${ids.normalPhasePctId}" type="number" min="0" max="100" step="any" class="form-input" placeholder="50" data-gradient-percent-field="true">
              </div>
              <div class="recurring-cost-action">
                <button type="button" class="recurring-add-btn" data-question-id="${q.id}" data-category="normal_phase_solvent">Add</button>
              </div>
            </div>
            ${renderOtherLookupControls(`${q.id}_normal_phase_solvent`, 'ml')}

            <div class="recurring-cost-grid">
              <div class="recurring-cost-field">
                <label for="${ids.reversePhaseSelectId}" class="input-label-small">Reverse phase solvent</label>
                <select id="${ids.reversePhaseSelectId}" name="${ids.reversePhaseSelectId}" class="form-input">
                  <option value="">Select solvent...</option>
                  ${reverseOptionsHtml}
                </select>
              </div>
              <div class="recurring-cost-field ${getRecurringMix(q.id).gradientMode === 'gradient' ? 'hidden' : ''}">
                <label for="${ids.reversePhasePctId}" class="input-label-small">Percent (%)</label>
                <input id="${ids.reversePhasePctId}" name="${ids.reversePhasePctId}" type="number" min="0" max="100" step="any" class="form-input" placeholder="50" data-gradient-percent-field="true">
              </div>
              <div class="recurring-cost-action">
                <button type="button" class="recurring-add-btn" data-question-id="${q.id}" data-category="reverse_phase_solvent">Add</button>
              </div>
            </div>
            ${renderOtherLookupControls(`${q.id}_reverse_phase_solvent`, 'ml')}

            <div class="recurring-cost-grid">
              <div class="recurring-cost-field">
                <label for="${ids.bufferSelectId}" class="input-label-small">Buffer</label>
                <select id="${ids.bufferSelectId}" name="${ids.bufferSelectId}" class="form-input">
                  <option value="">Select buffer...</option>
                  ${bufferOptionsHtml}
                </select>
              </div>
              <div class="recurring-cost-field">
                <label for="${ids.bufferPctId}" class="input-label-small">Amount (mg/L in water)</label>
                <input id="${ids.bufferPctId}" name="${ids.bufferPctId}" type="number" min="0" step="any" class="form-input" placeholder="10">
              </div>
              <div class="recurring-cost-action">
                <button type="button" class="recurring-add-btn" data-question-id="${q.id}" data-category="buffer">Add</button>
              </div>
            </div>
            ${renderOtherLookupControls(`${q.id}_buffer`, 'g')}

            <div class="recurring-cost-grid">
              <div class="recurring-cost-field">
                <label for="${ids.modifierSelectId}" class="input-label-small">Modifier</label>
                <select id="${ids.modifierSelectId}" name="${ids.modifierSelectId}" class="form-input">
                  <option value="">Select modifier...</option>
                  ${modifierOptionsHtml}
                </select>
              </div>
              <div class="recurring-cost-field">
                <label for="${ids.modifierPctId}" class="input-label-small">Amount (mg/L in water)</label>
                <input id="${ids.modifierPctId}" name="${ids.modifierPctId}" type="number" min="0" step="any" class="form-input" placeholder="0.1">
              </div>
              <div class="recurring-cost-action">
                <button type="button" class="recurring-add-btn" data-question-id="${q.id}" data-category="modifier">Add</button>
              </div>
            </div>
            ${renderOtherLookupControls(`${q.id}_modifier`, 'g')}

            <div class="recurring-cost-mix-sections">
              <h4 class="consumables-table-title">Table of total consumables</h4>
              <div class="recurring-cost-list-block">
	                <h5 class="phase-list-title">Normal phase</h5>
                <div id="${ids.normalPhaseListId}" class="recurring-cost-list"></div>
              </div>
              <div class="recurring-cost-list-block">
	                <h5 class="phase-list-title">Reverse phase</h5>
                <div id="${ids.reversePhaseListId}" class="recurring-cost-list"></div>
              </div>
              <div class="recurring-cost-list-block">
                <h4>Buffer</h4>
                <div id="${ids.bufferListId}" class="recurring-cost-list"></div>
              </div>
              <div class="recurring-cost-list-block">
                <h4>Modifier</h4>
                <div id="${ids.modifierListId}" class="recurring-cost-list"></div>
              </div>
            </div>

            <div id="${ids.gradientTableWrapId}" class="recurring-gradient-table-wrap hidden">
              <h4>Gradient profile</h4>
              <div class="recurring-cost-field">
                <label for="${ids.gradientFlowId}" class="input-label-small">Flow rate (mL/min)</label>
                <input id="${ids.gradientFlowId}" name="${ids.gradientFlowId}" type="number" min="0" step="any" class="form-input" placeholder="e.g. 1.2">
              </div>
              <table id="${ids.gradientTableId}" class="recurring-gradient-table"></table>
              <button type="button" id="${ids.gradientTableWrapId}_add_row" class="recurring-add-btn">Add duration row</button>
              <button type="button" id="${ids.gradientTableWrapId}_calculate" class="recurring-gradient-calculate-btn">Calculate gradient cost</button>
            </div>

            <div class="chem-lookup-total-section">
              <span id="${q.id}_score_output" class="question-score-output">Score: 0/100</span>
              <input id="${ids.totalId}" name="${ids.totalId}" type="hidden">
            </div>
          </div>
        `;
      }

      const wrapper = document.createElement('div');
      wrapper.id = 'question-wrapper-' + q.id;
      wrapper.className = 'question-wrapper';
      if (isConditional && !isVisible) wrapper.classList.add('hidden');
      wrapper.innerHTML = `
        <div class="form-question">
          <div class="question-label-row">
            <label id="${q.id}_label" for="${q.id}" class="question-label">${getQuestionDisplayText(q)}</label>
            ${getQuestionInfoText(q) ? `<span class="question-info-wrap"><button type="button" class="question-info-button" aria-label="Show formula information">i</button><span class="question-info-tooltip">${getQuestionInfoText(q)}</span></span>` : ''}
          </div>
          ${input}
        </div>
      `;
      form.appendChild(wrapper);
      if (q.id === 'green2') updateHazardScore();
      const infoButton = wrapper.querySelector('.question-info-button');
      const infoTooltip = wrapper.querySelector('.question-info-tooltip');
      if (infoButton && infoTooltip) {
        if (typeof window.renderMathInElement === 'function') {
          window.renderMathInElement(infoTooltip, { delimiters: [{ left: '$$', right: '$$', display: true }], throwOnError: false });
        }
      }

      if (q.type === 'recurring_cost_calculator') {
        const ids = getRecurringCostIds(q.id);
        const runEl = document.getElementById(ids.runId);
        const flowEl = document.getElementById(ids.flowId);
        const isocraticModeEl = document.getElementById(ids.isocraticModeId);
        const gradientModeEl = document.getElementById(ids.gradientModeId);
        if (runEl) runEl.addEventListener('input', () => updateRecurringCostTotal(q.id));
        if (flowEl) flowEl.addEventListener('input', () => updateRecurringCostTotal(q.id));
        const gradientFlowEl = document.getElementById(ids.gradientFlowId);
        if (gradientFlowEl) gradientFlowEl.addEventListener('input', () => updateRecurringCostTotal(q.id));
        const gradientCalculateButton = document.getElementById(`${ids.gradientTableWrapId}_calculate`);
        if (gradientCalculateButton) {
          gradientCalculateButton.addEventListener('click', () => {
            const flowRate = Number(gradientFlowEl?.value || 0) || 0;
            const validation = validateGradientProfile(q.id, flowRate);
            if (!validation.valid) {
              showRecurringCostMessage(q.id, validation.errors.join(' '), 'error');
              return;
            }
            updateRecurringCostTotal(q.id);
            showRecurringCostMessage(q.id, 'Gradient cost calculated. See the browser console for the segment breakdown.', 'success');
          });
        }
        if (isocraticModeEl) isocraticModeEl.addEventListener('change', () => {
          getRecurringMix(q.id).gradientMode = 'isocratic';
          applyRecurringModeVisibility(q.id, wrapper);
        });
        if (gradientModeEl) gradientModeEl.addEventListener('change', () => {
          getRecurringMix(q.id).gradientMode = 'gradient';
          applyRecurringModeVisibility(q.id, wrapper);
        });
        wrapper.querySelectorAll('.recurring-add-btn[data-category]').forEach(button => {
          button.addEventListener('click', () => addRecurringEntry(q.id, button.dataset.category));
        });
        ['normal_phase_solvent', 'reverse_phase_solvent', 'buffer', 'modifier'].forEach(category => {
          const selectId = category === 'normal_phase_solvent' ? ids.normalPhaseSelectId : category === 'reverse_phase_solvent' ? ids.reversePhaseSelectId : category === 'buffer' ? ids.bufferSelectId : ids.modifierSelectId;
          const select = document.getElementById(selectId);
          if (select) select.addEventListener('change', () => setOtherLookupVisibility(`${q.id}_${category}`, select.value === '__other__'));
          setupOtherLookup(`${q.id}_${category}`, 'ml', q.text || 'Mobile phase component price', () => {});
        });
        renderRecurringList(q.id, 'normal_phase_solvent');
        renderRecurringList(q.id, 'reverse_phase_solvent');
        renderRecurringList(q.id, 'buffer');
        renderRecurringList(q.id, 'modifier');
        applyRecurringModeVisibility(q.id, wrapper);
        updateRecurringCostTotal(q.id);
        updateHazardScore();
      }

      if (q.type === 'equipment_dropdown') {
        const ids = getEquipmentDropdownIds(q.id);
        const typeEl = document.getElementById(ids.typeId);
        const nameEl = document.getElementById(ids.nameId);
        if (typeEl) {
          typeEl.addEventListener('change', () => {
            if (typeEl.value === '__other__') {
              nameEl.value = '';
              nameEl.disabled = true;
              setOtherLookupVisibility(q.id, true);
              updateInstrumentDropdownTotal(q.id, ids);
            } else {
              nameEl.disabled = false;
              setOtherLookupVisibility(q.id, false);
              populateInstrumentNames(q.id, typeEl.value, ids);
            }
          });
          const selectedType = typeEl.value;
          if (selectedType) populateInstrumentNames(q.id, selectedType, ids);
        }
        if (nameEl) {
          nameEl.addEventListener('change', () => {
            setOtherLookupVisibility(q.id, nameEl.value === '__other__');
            updateInstrumentDropdownTotal(q.id, ids);
          });
        }
        setupOtherLookup(q.id, 'item', q.text || 'Primary instrument price', ({ name }) => {
          if (nameEl) nameEl.dataset.otherName = name;
          updateInstrumentDropdownTotal(q.id, ids);
        });
      }

      if (q.type === 'equipment_checklist') {
        const list = document.getElementById(q.id + '_equipment_list');
        const toggle = document.querySelector(`[data-target="${q.id}_equipment_panel"]`);
        const panel = document.getElementById(`${q.id}_equipment_panel`);
        const isSamplePretreatment = isSamplePretreatmentChecklist(q.id);
        const otherAddButton = document.querySelector(`[data-checklist-other="${q.id}"] .checklist-other-add-btn`);
        if (otherAddButton) otherAddButton.addEventListener('click', () => addChecklistOtherRow(q.id));
        const otherQueryAllButton = document.querySelector(`[data-checklist-other="${q.id}"] .checklist-other-query-all`);
        if (otherQueryAllButton) otherQueryAllButton.addEventListener('click', () => queryChecklistOtherItems(q.id));
        if (toggle && panel) {
          toggle.addEventListener('click', () => {
            const panels = document.querySelectorAll('.equipment-checklist-panel');
            const isOpen = !panel.classList.contains('hidden');
            panels.forEach(item => {
              item.classList.add('hidden');
              const control = document.querySelector(`[data-target="${item.id}"]`);
              if (control) {
                control.classList.remove('is-open');
                control.setAttribute('aria-expanded', 'false');
              }
            });
            if (!isOpen) {
              panel.classList.remove('hidden');
              toggle.classList.add('is-open');
              toggle.setAttribute('aria-expanded', 'true');
            }
          });
        }
        if (list) {
          list.querySelectorAll('input[type="checkbox"]').forEach(box => {
            box.addEventListener('change', () => {
              if (isSamplePretreatment) {
                const amountInputId = box.getAttribute('data-amount-input-id');
                const amountEl = amountInputId ? document.getElementById(amountInputId) : null;
                const amountRow = amountEl ? amountEl.closest('.sample-pretreat-amount-row') : null;
                if (amountRow) amountRow.classList.toggle('hidden', !box.checked);
                if (!box.checked && amountEl) amountEl.value = '';
              }
              const checked = list.querySelectorAll('input[type="checkbox"]:checked');
              const selectedItems = Array.from(checked).map(cb => {
                const amountInputId = cb.getAttribute('data-amount-input-id');
                const amountEl = amountInputId ? document.getElementById(amountInputId) : null;
                const amount = amountEl && amountEl.value !== '' ? Number(amountEl.value) : 0;
                return { name: cb.value, amount };
              });
              ANSWERS[q.id + '_items'] = JSON.stringify(isSamplePretreatment ? selectedItems : selectedItems.map(item => item.name));
              updateEquipmentChecklistTotal(q.id);
              updateHazardScore();
            });
          });
          if (isSamplePretreatment) {
            list.querySelectorAll('.sample-pretreat-amount-input').forEach(amountInput => {
              amountInput.addEventListener('input', () => {
                const checked = list.querySelectorAll('input[type="checkbox"]:checked');
                const selectedItems = Array.from(checked).map(cb => {
                  const amountInputId = cb.getAttribute('data-amount-input-id');
                  const amountEl = amountInputId ? document.getElementById(amountInputId) : null;
                  const amount = amountEl && amountEl.value !== '' ? Number(amountEl.value) : 0;
                  return { name: cb.value, amount };
                });
                ANSWERS[q.id + '_items'] = JSON.stringify(selectedItems);
                updateEquipmentChecklistTotal(q.id);
                updateHazardScore();
              });
            });
          }
        }
      }

      if (q.type === 'column_selector') {
        const ids = getColumnSelectorIds(q.id);
        const typeEl = document.getElementById(ids.columnTypeId);
        const nameEl = document.getElementById(ids.columnNameId);
        if (typeEl) {
          typeEl.addEventListener('change', () => {
            if (typeEl.value === '__other__') {
              if (nameEl) {
                nameEl.value = '';
                nameEl.disabled = true;
              }
              setOtherLookupVisibility(q.id, true);
              updateColumnSelectorTotal(q.id, ids);
            } else {
              if (nameEl) nameEl.disabled = false;
              setOtherLookupVisibility(q.id, false);
              populateColumnNames(q.id, typeEl.value, ids);
            }
          });
          const selectedType = typeEl.value;
          if (selectedType) populateColumnNames(q.id, selectedType, ids);
        }
        if (nameEl) nameEl.addEventListener('change', () => {
          setOtherLookupVisibility(q.id, nameEl.value === '__other__');
          updateColumnSelectorTotal(q.id, ids);
        });
        setupOtherLookup(q.id, 'item', q.text || 'Column price', ({ name }) => {
          if (nameEl) nameEl.dataset.otherName = name;
          updateColumnSelectorTotal(q.id, ids);
        });
      }
    });
    updateCurrentSectionScore();
  }

  function renderRelatedQuestionData() {
    if (typeof window.restoreCurrentTabAnswers === 'function') {
      window.restoreCurrentTabAnswers();
    }
    if (typeof window.updateSectionGuidance === 'function') {
      window.updateSectionGuidance();
    }
  }

  function debugAutofillAllQuestions() {
    if (!QUESTION_AREAS || !QUESTION_AREAS.length) return;
    const answers = {};

    QUESTION_AREAS.forEach(area => {
      (area.questions || []).forEach(q => {
        if (!q || q.type === 'label') return;

        if (q.type === 'dropdown') {
          const opts = typeof q.options === 'string' ? q.options.split(';').map(s => s.trim()).filter(Boolean) : (Array.isArray(q.options) ? q.options : []);
          answers[q.id] = opts[0] || 'Yes';
          return;
        }

        if (q.type === 'csv_dropdown') {
          const params = typeof q.params === 'string' ? (() => { try { return JSON.parse(q.params); } catch { return {}; } })() : (q.params || {});
          const source = Array.isArray(window[params.source || 'SAMPLE_ANALYSIS_RESULTS_OPTIONS']) ? window[params.source || 'SAMPLE_ANALYSIS_RESULTS_OPTIONS'] : [];
          const first = source[0];
          if (first) answers[q.id] = String(first[params.valueField || 'value'] ?? first.value ?? first.difficulty ?? first.sample ?? '');
          return;
        }

        if (q.type === 'boolean') {
          answers[q.id] = 'true';
          return;
        }

        if (q.type === 'number') {
          answers[q.id] = String(12);
          return;
        }

        if (q.type === 'text') {
          answers[q.id] = 'debug-' + q.id;
          return;
        }

        if (q.type === 'equipment_dropdown') {
          const instruments = Array.isArray(window.INSTRUMENT_OPTIONS) ? window.INSTRUMENT_OPTIONS : [];
          if (instruments.length) answers[q.id] = { category: instruments[0].type || 'Other', name: instruments[0].name };
          return;
        }

        if (q.type === 'column_selector') {
          const columns = Array.isArray(window.COLUMN_OPTIONS) ? window.COLUMN_OPTIONS : [];
          if (columns.length) answers[q.id] = { category: columns[0].type || 'Other', name: columns[0].fullName || columns[0].name };
          return;
        }

        if (q.type === 'equipment_checklist') {
          const options = typeof window.getAuxiliaryEquipmentOptions === 'function' ? window.getAuxiliaryEquipmentOptions(q.id) : [];
          const selected = options.slice(0, 2).map(item => item.name).filter(Boolean);
          if (isSamplePretreatmentChecklist(q.id)) {
            answers[q.id] = selected.map(name => ({ name, amount: 1 }));
          } else {
            answers[q.id] = selected;
          }
          return;
        }

        if (q.type === 'recurring_cost_calculator') {
          const normal = (Array.isArray(SOLVENT_OPTIONS) ? SOLVENT_OPTIONS : []).filter(item => String(item.phase || '').toLowerCase() === 'normal');
          const reverse = (Array.isArray(SOLVENT_OPTIONS) ? SOLVENT_OPTIONS : []).filter(item => String(item.phase || '').toLowerCase() === 'reverse');
          const buffers = Array.isArray(BUFFER_OPTIONS) ? BUFFER_OPTIONS : [];
          const makeEntry = (name, price, percent, category) => ({
            id: `${category}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            name,
            percent,
            amountMgPerL: 0,
            price,
            disclaimer: '',
            gradientLetter: '',
            cost: price * (percent / 100) / 1000
          });
          const normalEntries = normal.length ? [makeEntry(normal[0].name, normal[0].price, 50, 'normal_phase_solvent')] : [];
          const reverseEntries = reverse.length ? [makeEntry(reverse[0].name, reverse[0].price, 50, 'reverse_phase_solvent')] : [];
          const bufferEntries = buffers.length ? [makeEntry(buffers[0].name, buffers[0].price, 10, 'buffer')] : [];
          answers[q.id + '_run'] = '30';
          answers[q.id + '_flow'] = '1.2';
          answers[q.id + '_gradient_flow'] = '1.2';
          answers[q.id + '_gradient_mode'] = 'isocratic';
          answers[q.id + '_normal_phase_solvent_entries'] = JSON.stringify(normalEntries);
          answers[q.id + '_reverse_phase_solvent_entries'] = JSON.stringify(reverseEntries);
          answers[q.id + '_buffer_entries'] = JSON.stringify(bufferEntries);
          answers[q.id + '_modifier_entries'] = JSON.stringify([]);
          answers[q.id + '_gradient_rows'] = JSON.stringify([{ time: 0, values: { A: 50, B: 50 } }, { time: 10, values: { A: 50, B: 50 } }]);
          return;
        }
      });
    });

    if (typeof window.importQuestionnaireJson === 'function') {
      window.importQuestionnaireJson({ answers });
    } else {
      window.ANSWERS = answers;
      if (window.renderQuestions) window.renderQuestions();
      if (window.restoreCurrentTabAnswers) window.restoreCurrentTabAnswers();
    }
    checkFormValidity();
  }

  async function autoFillMissingOtherPrices() {
    if (typeof window.lookupChemicalPrice !== 'function') return;
    const questions = (QUESTION_AREAS || []).flatMap(area => area.questions || []);
    const pending = [];
    questions.forEach(q => {
      if (q.type === 'equipment_dropdown') {
        const ids = getEquipmentDropdownIds(q.id);
        const name = ANSWERS[ids.nameId];
        if (ANSWERS[ids.typeId] === '__other__' && name && (ANSWERS[q.id] === undefined || ANSWERS[q.id] === '')) {
          pending.push({ q, name, update: () => updateInstrumentDropdownTotal(q.id, ids) });
        }
      }
      if (q.type === 'column_selector') {
        const ids = getColumnSelectorIds(q.id);
        const name = ANSWERS[ids.columnNameId];
        if (ANSWERS[ids.columnTypeId] === '__other__' && name && (ANSWERS[q.id] === undefined || ANSWERS[q.id] === '')) {
          pending.push({ q, name, update: () => updateColumnSelectorTotal(q.id, ids) });
        }
      }
    });
    for (const item of pending) {
      try {
        const result = await window.lookupChemicalPrice(item.name, 'US', 'item', item.q.text || item.q.id || '');
        if (result && result.success) {
          ANSWERS[item.q.id] = String(result.price);
          ANSWERS[item.q.id + '_total'] = String(result.price);
          const priceEl = document.getElementById(`${item.q.id}_other_price`);
          if (priceEl) priceEl.value = String(result.price);
          item.update();
        }
      } catch { /* leave for manual query */ }
    }
  }

  function reapplyAiFilledMarks() {
    if (window.AI_FILLED_ANSWERS && typeof markAiFilledAnswers === 'function') {
      markAiFilledAnswers(window.AI_FILLED_ANSWERS);
    }
  }

  function markAiFilledAnswers(aiAnswers) {
    window.AI_FILLED_ANSWERS = aiAnswers || null;
    if (!aiAnswers || typeof aiAnswers !== 'object') return;
    const questionMap = new Map();
    (QUESTION_AREAS || []).forEach(area => (area.questions || []).forEach(q => questionMap.set(q.id, q)));
    const stripSuffix = key => key.replace(/_(items|total|name|type|run|flow|gradient_flow|gradient_mode|normal_phase_solvent_entries|reverse_phase_solvent_entries|solvent_entries|buffer_entries|modifier_entries|gradient_rows|price|grams|link)$/, '');
    const mark = el => { if (el) el.classList.add('ai-filled'); };
    const markLabels = id => {
      [id + '_true', id + '_false'].forEach(radioId => {
        const label = document.querySelector(`label[for="${radioId}"]`);
        if (label) label.classList.add('ai-filled');
      });
    };

    Object.keys(aiAnswers).forEach(key => {
      const questionId = stripSuffix(key);
      const q = questionMap.get(questionId);
      if (!q) return;
      if (q.type === 'boolean') {
        mark(document.getElementById(q.id + '_true'));
        mark(document.getElementById(q.id + '_false'));
        markLabels(q.id);
      } else if (q.type === 'equipment_dropdown' || q.type === 'column_selector') {
        mark(document.getElementById(q.id + '_type'));
        mark(document.getElementById(q.id + '_name'));
        mark(document.getElementById(q.id + '_other_name'));
        mark(document.getElementById(q.id + '_other_price'));
      } else if (q.type === 'equipment_checklist') {
        const list = document.getElementById(q.id + '_equipment_list');
        if (list) {
          list.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            const wrap = cb.closest('.equipment-check-item-wrap');
            if (wrap) wrap.classList.add('ai-filled');
            else mark(cb);
            const amountInputId = cb.getAttribute('data-amount-input-id');
            const amountEl = amountInputId ? document.getElementById(amountInputId) : null;
            if (amountEl) amountEl.classList.add('ai-filled');
          });
        }
      } else if (q.type === 'recurring_cost_calculator') {
        const calc = document.getElementById(q.id + '_calculator');
        if (calc) calc.querySelectorAll('input, select').forEach(el => el.classList.add('ai-filled'));
      } else if (q.type === 'chem_lookup') {
        mark(document.getElementById(q.id + '_name'));
        mark(document.getElementById(q.id + '_price'));
        mark(document.getElementById(q.id + '_grams'));
      } else {
        mark(document.getElementById(q.id));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const helpToggle = document.getElementById('section-guidance-toggle');
    if (helpToggle) {
      helpToggle.addEventListener('click', () => toggleSectionGuidance());
    }

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.name || !target.name.endsWith('_mode_group')) return;
      const questionId = target.name.replace(/_mode_group$/, '');
      const nextMode = target.value === 'gradient' ? 'gradient' : 'isocratic';
      const mix = getRecurringMix(questionId);
      mix.gradientMode = nextMode;
      applyRecurringModeVisibility(questionId, document.getElementById(`${questionId}_calculator`));
    });

    const routineBtn = document.getElementById('routine-analysis-btn');
    const advancedBtn = document.getElementById('advanced-analysis-btn');
    if (routineBtn) routineBtn.addEventListener('click', () => chooseAnalysisMode('routine'));
    if (advancedBtn) advancedBtn.addEventListener('click', () => chooseAnalysisMode('advanced'));

    function showPdfNotification(message, type = 'loading') {
      const el = document.getElementById('pdf-autofill-notification');
      if (!el) return;
      el.className = `pdf-autofill-notification ${type}`;
      el.innerHTML = `<span>${message}</span><button type="button" class="pdf-notification-dismiss" aria-label="Dismiss">&times;</button>`;
      const dismissBtn = el.querySelector('.pdf-notification-dismiss');
      if (dismissBtn) {
        dismissBtn.onclick = () => {
          el.className = 'pdf-autofill-notification hidden';
          el.innerHTML = '';
        };
      }
    }

    const pdfInput = document.getElementById('analysis-pdf-file');
    if (pdfInput) {
      pdfInput.addEventListener('change', async () => {
        const file = pdfInput.files && pdfInput.files[0];
        const mode = pdfInput.dataset.analysisMode || 'routine';
        const status = document.getElementById('analysis-pdf-status');
        if (!file) return;
        ANALYSIS_MODE = mode;
        ANALYSIS_GATE_CHOSEN = true;
        if (status) status.textContent = 'Extracting selectable PDF text...';
        showQuestionnaireIfReady();
        showPdfNotification('Extracting PDF text and analyzing questionnaire with AI...', 'loading');
        try {
          const questionnaire = window.buildQuestionnaireJson();
          const result = await window.fillQuestionnaireFromPdf(file, questionnaire);
          if (!result.success) throw new Error(result.error || 'The PDF could not be processed.');
          window.importQuestionnaireJson(result.questionnaire || result);
          if (typeof window.markAiFilledAnswers === 'function') {
            window.markAiFilledAnswers((result.questionnaire && result.questionnaire.answers) || result.answers || {});
          }
          if (status) status.textContent = 'PDF values imported. Review the answers before continuing.';
          showPdfNotification('PDF values imported successfully! Fields filled by AI are highlighted. Review the answers before continuing.', 'success');
        } catch (error) {
          const msg = error.message || 'PDF auto-fill failed. You can complete the questionnaire manually.';
          if (status) status.textContent = msg;
          showPdfNotification(`PDF auto-fill notice: ${msg}`, 'error');
          console.warn('[PharmaScore] PDF auto-fill failed:', error);
        } finally {
          pdfInput.value = '';
        }
      });
    }

    const debugBtn = document.getElementById('debug-autofill-btn');
    if (debugBtn) debugBtn.addEventListener('click', debugAutofillAllQuestions);

    const retakeBtn = document.getElementById('retake-btn');
    if (retakeBtn) {
      retakeBtn.addEventListener('click', function () {
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) resultsSection.classList.add('hidden');
        for (const key in ANSWERS) delete ANSWERS[key];
        if (window.RECURRING_MIXES) {
          for (const key in window.RECURRING_MIXES) delete window.RECURRING_MIXES[key];
        }
        if (window.SOLVENT_LISTS) {
          for (const key in window.SOLVENT_LISTS) delete window.SOLVENT_LISTS[key];
        }
        window.AI_FILLED_ANSWERS = null;
        ANALYSIS_GATE_CHOSEN = false;
        currentTab = 0;
        fixedCostsSubTab = 0;
        analyticalPerformanceSubTab = 0;
        analyticalConsumablesSubTab = 0;
        const gate = document.getElementById('analysis-gate');
        const main = document.querySelector('main');
        const nav = document.querySelector('nav');
        const progress = document.getElementById('progress-indicator');
        if (gate) gate.classList.remove('hidden');
        if (main) main.classList.add('hidden');
        if (nav) nav.classList.add('hidden');
        if (progress) progress.classList.add('hidden');
      });
    }

    const downloadGraphic = (format) => {
      if (typeof window.downloadResultsGraphic === 'function') window.downloadResultsGraphic(format);
    };
    const downloadSvgBtn = document.getElementById('download-results-svg');
    const downloadPngBtn = document.getElementById('download-results-png');
    if (downloadSvgBtn) downloadSvgBtn.addEventListener('click', () => downloadGraphic('svg'));
    if (downloadPngBtn) downloadPngBtn.addEventListener('click', () => downloadGraphic('png'));

    if (typeof loadQuestionsFromCSV === 'function') {
      loadQuestionsFromCSV();
    }
  });

  Object.defineProperties(window, {
    toggleSectionGuidance: { value: toggleSectionGuidance, configurable: true },
    updateSectionGuidance: { value: updateSectionGuidance, configurable: true },
    updateCurrentSectionScore: { value: updateCurrentSectionScore, configurable: true },
    updateHazardScore: { value: updateHazardScore, configurable: true },
    autoFillMissingOtherPrices: { value: autoFillMissingOtherPrices, configurable: true },
    markAiFilledAnswers: { value: markAiFilledAnswers, configurable: true },
    reapplyAiFilledMarks: { value: reapplyAiFilledMarks, configurable: true },
    isFixedCostsArea: { value: isFixedCostsArea, configurable: true },
    getFixedCostSubTab: { value: getFixedCostSubTab, configurable: true },
    getQuestionsForCurrentView: { value: getQuestionsForCurrentView, configurable: true },
    renderFixedCostSubTabs: { value: renderFixedCostSubTabs, configurable: true },
    renderEquipmentPriceSummary: { value: renderEquipmentPriceSummary, configurable: true },
    showQuestionnaireIfReady: { value: showQuestionnaireIfReady, configurable: true },
    chooseAnalysisMode: { value: chooseAnalysisMode, configurable: true },
    updateSectionTitle: { value: updateSectionTitle, configurable: true },
    updateProgress: { value: updateProgress, configurable: true },
    updateNavButtons: { value: updateNavButtons, configurable: true },
    iconKeyFromText: { value: iconKeyFromText, configurable: true },
    renderTabs: { value: renderTabs, configurable: true },
    formatUnitLabel: { value: formatUnitLabel, configurable: true },
    renderSimpleSelect: { value: renderSimpleSelect, configurable: true },
    renderMappedSelect: { value: renderMappedSelect, configurable: true },
    getColumnSelectorIds: { value: getColumnSelectorIds, configurable: true },
    getEquipmentDropdownIds: { value: getEquipmentDropdownIds, configurable: true },
    setOtherLookupVisibility: { value: setOtherLookupVisibility, configurable: true },
    getRecurringCostIds: { value: getRecurringCostIds, configurable: true },
    getRecurringMix: { value: getRecurringMix, configurable: true },
    applyRecurringModeVisibility: { value: applyRecurringModeVisibility, configurable: true },
    parseRecurringEntries: { value: parseRecurringEntries, configurable: true },
    renderRecurringList: { value: renderRecurringList, configurable: true },
    addRecurringEntry: { value: addRecurringEntry, configurable: true },
    addChecklistOtherItem: { value: addChecklistOtherItem, configurable: true },
    syncCustomChecklistAnswers: { value: syncCustomChecklistAnswers, configurable: true },
    updateRecurringCostTotal: { value: updateRecurringCostTotal, configurable: true },
    validateGradientProfile: { value: validateGradientProfile, configurable: true },
    normalizeGradientRows: { value: normalizeGradientRows, configurable: true },
    populateColumnNames: { value: populateColumnNames, configurable: true },
    populateInstrumentNames: { value: populateInstrumentNames, configurable: true },
    updateColumnSelectorTotal: { value: updateColumnSelectorTotal, configurable: true },
    updateInstrumentDropdownTotal: { value: updateInstrumentDropdownTotal, configurable: true },
    getAuxiliaryEquipmentOptions: { value: getAuxiliaryEquipmentOptions, configurable: true },
    updateEquipmentChecklistTotal: { value: updateEquipmentChecklistTotal, configurable: true },
    renderQuestions: { value: renderQuestions, configurable: true },
    debugAutofillAllQuestions: { value: debugAutofillAllQuestions, configurable: true }
  });

  window.getColumnSelectorIds = getColumnSelectorIds;
  window.getEquipmentDropdownIds = getEquipmentDropdownIds;
  window.getRecurringCostIds = getRecurringCostIds;
  window.getRecurringMix = getRecurringMix;
  window.parseRecurringEntries = parseRecurringEntries;
  window.getAuxiliaryEquipmentOptions = getAuxiliaryEquipmentOptions;
}());
