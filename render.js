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
      return area.questions.filter(q => selectedIds.has(q.id));
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
    const scores = calculateScores(QUESTION_AREAS, ANSWERS, ANALYSIS_MODE);
    const score = Number(scores[area.title] || 0);
    scoreEl.innerHTML = `<span>${area.title} score: ${score}/100</span>`;
  }

  function getQuestionThresholdScore(questionId, value) {
    const question = QUESTION_AREAS.flatMap(area => area.questions || []).find(item => item.id === questionId);
    if (!question) return 0;
    try {
      const params = typeof question.params === 'object' ? question.params : JSON.parse(question.params || '{}');
      const matchingRange = (params.ranges || []).filter(range => Number(value) <= Number(range.max)).sort((a, b) => Number(b.score) - Number(a.score))[0];
      return matchingRange ? Number(matchingRange.score) : 0;
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
      const iconKey = iconKeyFromText(area.title);
      iconSlot.dataset.iconKey = iconKey;
      iconSlot.style.setProperty('--icon-url', `url('./assets/icons/${iconKey}.svg')`);
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
      progressLabel.textContent = `Section ${stepNumber} of ${totalSteps}: ${currentArea ? currentArea.title : 'Section'}`;
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
        gradientRows: [{ from: 0, to: 10, values: {} }]
      };
    }
    return window.RECURRING_MIXES[questionId];
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
    const rows = Array.isArray(mix.gradientRows) && mix.gradientRows.length ? mix.gradientRows : [{ from: 0, to: 10, values: {} }];

    tableEl.innerHTML = `
      <thead>
        <tr>
          <th>From time</th>
          <th>To time</th>
          ${assignments.map(assignment => `<th>${assignment.entry.name}</th>`).join('')}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, rowIndex) => `
          <tr>
            <td><input type="number" min="0" step="any" data-row-index="${rowIndex}" data-field="from" value="${Number(row.from || 0)}"></td>
            <td><input type="number" min="0" step="any" data-row-index="${rowIndex}" data-field="to" value="${Number(row.to || 0)}"></td>
            ${letters.map(letter => {
              const key = letter;
              const value = row.values && row.values[key] !== undefined ? row.values[key] : (assignments.find(item => item.letter === letter)?.entry?.percent || '');
              const readOnly = letter === 'A' && assignments.some(item => item.letter === 'A' && item.entry && /water/i.test(String(item.entry.name || '')));
              return `<td><input type="number" min="0" max="100" step="any" data-row-index="${rowIndex}" data-field="${letter}" value="${value}" ${readOnly ? 'readonly' : ''}></td>`;
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
        if (!rows[rowIndex]) rows[rowIndex] = { from: 0, to: 10, values: {} };
        if (field === 'from' || field === 'to') {
          rows[rowIndex][field] = Number(target.value || 0);
        } else {
          rows[rowIndex].values = rows[rowIndex].values || {};
          rows[rowIndex].values[field] = Number(target.value || 0);
        }
        mix.gradientRows = rows;
        updateRecurringCostTotal(questionId);
      });
    });

    tableEl.querySelectorAll('[data-gradient-remove-row]').forEach(button => {
      button.addEventListener('click', () => {
        const rowIndex = Number(button.dataset.gradientRemoveRow);
        if (rows.length <= 1) return;
        rows.splice(rowIndex, 1);
        mix.gradientRows = rows;
        renderGradientTable(questionId);
        updateRecurringCostTotal(questionId);
      });
    });

    const addRowButton = document.getElementById(`${ids.gradientTableWrapId}_add_row`);
    if (addRowButton) {
      addRowButton.onclick = () => {
        const previous = rows[rows.length - 1] || { from: 0, to: 10, values: {} };
        const nextFrom = Number(previous.to || previous.from || 0);
        const nextTo = nextFrom + 10;
        rows.push({ from: nextFrom, to: nextTo, values: Object.fromEntries(assignments.map(item => [item.letter, Number(previous.values?.[item.letter] ?? item.entry.percent ?? 0)])) });
        mix.gradientRows = rows;
        renderGradientTable(questionId);
        updateRecurringCostTotal(questionId);
      };
    }

    const mode = mix.gradientMode || 'isocratic';
    tableWrap.classList.toggle('hidden', mode !== 'gradient');
  }

  function getGradientCostBreakdown(questionId, flowRate) {
    const mix = getRecurringMix(questionId);
    const rows = Array.isArray(mix.gradientRows) ? mix.gradientRows : [];
    const solventEntries = [...(mix.normalPhaseSolvents || []), ...(mix.reversePhaseSolvents || [])];
    const water = solventEntries.find(entry => /water/i.test(String(entry.name || '')));
    const breakdown = [];
    rows.forEach((row, index) => {
      const duration = Math.max(0, Number(row.to || 0) - Number(row.from || 0));
      if (!duration || !flowRate) return;
      const volumeMl = duration * flowRate;
      const values = row.values || {};
      solventEntries.forEach(entry => {
        const percent = Number(values[entry.gradientLetter] ?? entry.percent ?? 0);
        const cost = volumeMl * (percent / 100) * Number(entry.price || 0);
        breakdown.push({ segment: index + 1, component: entry.name, basis: 'mL', durationMin: duration, volumeMl, concentration: percent, costEUR: Number(cost.toFixed(6)) });
      });
      const waterShare = water ? Number(values.A ?? water.percent ?? 0) / 100 : 1;
      const aqueousVolumeL = (volumeMl * waterShare) / 1000;
      [...(mix.buffers || []), ...(mix.modifiers || [])].forEach(entry => {
        const mgPerL = Number(entry.amountMgPerL ?? entry.percent ?? 0);
        const cost = aqueousVolumeL * mgPerL / 1000 * Number(entry.price || 0);
        breakdown.push({ segment: index + 1, component: entry.name, basis: 'mg/L in aqueous phase', durationMin: duration, volumeMl, concentration: mgPerL, costEUR: Number(cost.toFixed(6)) });
      });
    });
    return breakdown;
  }

  function calculateGradientCost(questionId, flowRate) {
    return getGradientCostBreakdown(questionId, flowRate).reduce((sum, item) => sum + item.costEUR, 0);
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
    listEl.innerHTML = entries.map((entry, index) => `
      <div class="recurring-cost-entry\">
        <span>${isGradient ? entry.name : (entry.gradientLetter ? `${entry.gradientLetter} - ` : '') + entry.name} ${!isGradient ? `(${entry.percent}%)` : ''}${entry.disclaimer ? ` <small>${entry.disclaimer}</small>` : ''}</span>
        <button type="button" class="recurring-remove-btn" data-question-id="${questionId}" data-category="${category}" data-index="${index}">Remove</button>
      </div>
    `).join('');

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
      return sum + (price * amount);
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
      const matchingRange = (params.ranges || []).filter(range => total <= Number(range.max)).sort((a, b) => Number(b.score) - Number(a.score))[0];
      score = matchingRange ? Number(matchingRange.score) : 0;
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
    if (!selectEl || !selectEl.value) {
      showRecurringCostMessage(questionId, 'Please choose an option before adding it to the list.', 'error');
      return;
    }

    const percent = isGradientMode ? 0 : Number(pctEl && pctEl.value !== '' ? pctEl.value : 0);
    if (!isGradientMode && (!Number.isFinite(percent) || percent <= 0)) {
      showRecurringCostMessage(questionId, 'Please enter a valid percentage greater than zero.', 'error');
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
        : price * (percent / 100)
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
        input = `<div class="number-input-wrapper"><input id="${q.id}" name="${q.id}" type="number" min="0" step="any" class="form-input" required><span class="unit-label">${unitLabel}</span></div>`;
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
              <div class="recurring-cost-field ${getRecurringMix(q.id).gradientMode === 'gradient' ? 'hidden' : ''}">
                <label for="${ids.bufferPctId}" class="input-label-small">Amount (mg/L in water)</label>
                <input id="${ids.bufferPctId}" name="${ids.bufferPctId}" type="number" min="0" max="100" step="any" class="form-input" placeholder="10" data-gradient-percent-field="true">
              </div>
              <div class="recurring-cost-action">
                <button type="button" class="recurring-add-btn" data-question-id="${q.id}" data-category="buffer">Add</button>
              </div>
            </div>
            ${renderOtherLookupControls(`${q.id}_buffer`, 'ml')}

            <div class="recurring-cost-grid">
              <div class="recurring-cost-field">
                <label for="${ids.modifierSelectId}" class="input-label-small">Modifier</label>
                <select id="${ids.modifierSelectId}" name="${ids.modifierSelectId}" class="form-input">
                  <option value="">Select modifier...</option>
                  ${modifierOptionsHtml}
                </select>
              </div>
              <div class="recurring-cost-field ${getRecurringMix(q.id).gradientMode === 'gradient' ? 'hidden' : ''}">
                <label for="${ids.modifierPctId}" class="input-label-small">Amount (mg/L in water)</label>
                <input id="${ids.modifierPctId}" name="${ids.modifierPctId}" type="number" min="0" max="100" step="any" class="form-input" placeholder="0.1" data-gradient-percent-field="true">
              </div>
              <div class="recurring-cost-action">
                <button type="button" class="recurring-add-btn" data-question-id="${q.id}" data-category="modifier">Add</button>
              </div>
            </div>
            ${renderOtherLookupControls(`${q.id}_modifier`, 'ml')}

            <div class="recurring-cost-mix-sections">
              <div class="recurring-cost-list-block">
                <h4>Normal phase</h4>
                <div id="${ids.normalPhaseListId}" class="recurring-cost-list"></div>
              </div>
              <div class="recurring-cost-list-block">
                <h4>Reverse phase</h4>
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
              <button type="button" id="${ids.gradientTableWrapId}_add_row" class="recurring-add-btn">Add time row</button>
              <button type="button" id="${ids.gradientTableWrapId}_calculate" class="recurring-add-btn">Calculate gradient cost</button>
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
              });
            });
          }
        }
      }

      if (q.type === 'column_selector') {
        const ids = getColumnSelectorIds(q.id);
        const typeEl = document.getElementById(ids.columnTypeId);
        if (typeEl) {
          typeEl.addEventListener('change', () => {
            if (typeEl.value === '__other__') {
              nameEl.value = '';
              nameEl.disabled = true;
              setOtherLookupVisibility(q.id, true);
              updateColumnSelectorTotal(q.id, ids);
            } else {
              nameEl.disabled = false;
              setOtherLookupVisibility(q.id, false);
              populateColumnNames(q.id, typeEl.value, ids);
            }
          });
          const selectedType = typeEl.value;
          if (selectedType) populateColumnNames(q.id, selectedType, ids);
        }
        const nameEl = document.getElementById(ids.columnNameId);
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
    const sampledEnumValues = { dropdown: ['Yes', 'No'], number: 12, text: 'debug' };

    QUESTION_AREAS.forEach(area => {
      (area.questions || []).forEach(q => {
        if (!q || q.type === 'label') return;

        if (q.type === 'dropdown') {
          const opts = typeof q.options === 'string' ? q.options.split(';').filter(Boolean) : [];
          const value = opts[0] || sampledEnumValues.dropdown[0];
          ANSWERS[q.id] = value;
          const el = document.getElementById(q.id);
          if (el && value) el.value = value;
          return;
        }

        if (q.type === 'boolean') {
          ANSWERS[q.id] = 'true';
          const el = document.getElementById(q.id + '_true');
          if (el) el.checked = true;
          return;
        }

        if (q.type === 'number') {
          const value = String(sampledEnumValues.number);
          ANSWERS[q.id] = value;
          const el = document.getElementById(q.id);
          if (el) el.value = value;
          return;
        }

        if (q.type === 'text') {
          const value = sampledEnumValues.text + '-' + q.id;
          ANSWERS[q.id] = value;
          const el = document.getElementById(q.id);
          if (el) el.value = value;
          return;
        }

        if (q.type === 'equipment_dropdown') {
          const select = document.getElementById(q.id);
          if (select && select.options.length > 1) {
            select.value = select.options[1].value;
            const price = Number(select.options[1].getAttribute('data-price') || 0);
            ANSWERS[q.id + '_name'] = select.options[1].value;
            ANSWERS[q.id] = String(price);
            ANSWERS[q.id + '_total'] = String(price);
            const total = document.getElementById(q.id + '_total');
            if (total) total.value = String(price);
          }
          return;
        }

        if (q.type === 'equipment_checklist') {
          const list = document.getElementById(q.id + '_equipment_list');
          if (list) {
            const boxes = list.querySelectorAll('input[type="checkbox"]');
            boxes.forEach((box, idx) => {
              box.checked = idx === 0 || idx === 1;
            });
            if (isSamplePretreatmentChecklist(q.id)) {
              Array.from(boxes).forEach(box => {
                const amountInputId = box.getAttribute('data-amount-input-id');
                const amountEl = amountInputId ? document.getElementById(amountInputId) : null;
                const amountRow = amountEl ? amountEl.closest('.sample-pretreat-amount-row') : null;
                if (amountRow) amountRow.classList.toggle('hidden', !box.checked);
                if (amountEl && box.checked) amountEl.value = '1';
              });
              const selectedItems = Array.from(boxes).filter(b => b.checked).map(b => ({ name: b.value, amount: 1 }));
              ANSWERS[q.id + '_items'] = JSON.stringify(selectedItems);
              updateEquipmentChecklistTotal(q.id);
            } else {
              const total = Array.from(boxes).filter(b => b.checked).reduce((sum, b) => sum + Number(b.getAttribute('data-price') || 0), 0);
              ANSWERS[q.id] = String(total);
              ANSWERS[q.id + '_items'] = JSON.stringify(Array.from(boxes).filter(b => b.checked).map(b => b.value));
              ANSWERS[q.id + '_total'] = String(total);
              const totalEl = document.getElementById(q.id + '_total');
              if (totalEl) totalEl.value = String(total);
            }
          }
          return;
        }

        if (q.type === 'column_selector') {
          const ids = getColumnSelectorIds(q.id);
          const typeEl = document.getElementById(ids.columnTypeId);
          const nameEl = document.getElementById(ids.columnNameId);
          if (typeEl && typeEl.options.length > 1) {
            typeEl.value = typeEl.options[1].value;
            populateColumnNames(q.id, typeEl.value, ids); 
          }
          if (nameEl && nameEl.options.length > 1) {
            nameEl.value = nameEl.options[1].value;
            updateColumnSelectorTotal(q.id);
          }
          return;
        }

        if (q.type === 'recurring_cost_calculator') {
          const ids = getRecurringCostIds(q.id);
          const runEl = document.getElementById(ids.runId);
          const flowEl = document.getElementById(ids.flowId);
          if (runEl) runEl.value = '30';
          if (flowEl) flowEl.value = '1.2';
          const normalSelect = document.getElementById(ids.normalPhaseSelectId);
          const normalPct = document.getElementById(ids.normalPhasePctId);
          if (normalSelect && normalSelect.options.length > 1) {
            normalSelect.value = normalSelect.options[1].value;
            if (normalPct) normalPct.value = '50';
            addRecurringEntry(q.id, 'normal_phase_solvent');
          }
          const bufferSelect = document.getElementById(ids.bufferSelectId);
          const bufferPct = document.getElementById(ids.bufferPctId);
          if (bufferSelect && bufferSelect.options.length > 1) {
            const waterPresent = (bufferSelect.options[1].text || '').toLowerCase().includes('water');
            if (waterPresent) {
              bufferSelect.value = bufferSelect.options[1].value;
              if (bufferPct) bufferPct.value = '10';
              addRecurringEntry(q.id, 'buffer');
            }
          }
          const modifierSelect = document.getElementById(ids.modifierSelectId);
          const modifierPct = document.getElementById(ids.modifierPctId);
          if (modifierSelect && modifierSelect.options.length > 1) {
            modifierSelect.value = modifierSelect.options[1].value;
            if (modifierPct) modifierPct.value = '0.1';
            addRecurringEntry(q.id, 'modifier');
          }
          updateRecurringCostTotal(q.id);
        }
      });
    });
    checkFormValidity();
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
        try {
          console.info('[PharmaScore] PDF autofill started:', { fileName: file.name, size: file.size, mode });
          showQuestionnaireIfReady();
          const questionnaire = window.buildQuestionnaireJson();
          const result = await window.fillQuestionnaireFromPdf(file, questionnaire);
          if (!result.success) throw new Error(result.error || 'The PDF could not be processed.');
          console.info('[PharmaScore] Importing AI questionnaire answers:', {
            answerCount: result.questionnaire?.answers ? Object.keys(result.questionnaire.answers).length : 0,
            unfilledCount: Array.isArray(result.unfilled) ? result.unfilled.length : null
          });
          window.importQuestionnaireJson(result.questionnaire || result);
          if (status) status.textContent = 'PDF values imported. Review the answers before continuing.';
        } catch (error) {
          if (status) status.textContent = error.message || 'PDF auto-fill failed. You can complete the questionnaire manually.';
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
        currentTab = 0;
        const main = document.querySelector('main');
        if (main) main.classList.remove('hidden');
        renderTabs();
        renderQuestions();
        updateSectionTitle();
        updateProgress();
        updateNavButtons();
        checkFormValidity();
      });
    }

    if (typeof loadQuestionsFromCSV === 'function') {
      loadQuestionsFromCSV();
    }
  });

  Object.defineProperties(window, {
    toggleSectionGuidance: { value: toggleSectionGuidance, configurable: true },
    updateSectionGuidance: { value: updateSectionGuidance, configurable: true },
    updateCurrentSectionScore: { value: updateCurrentSectionScore, configurable: true },
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
    updateRecurringCostTotal: { value: updateRecurringCostTotal, configurable: true },
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
