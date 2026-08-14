(function () {
  function saveCurrentTabAnswers() {
    const area = QUESTION_AREAS[currentTab];
    if (!area) return;
    getQuestionsForCurrentView(area).forEach(q => {
      if (q.type === 'label') return;
      if (q.type === 'boolean') {
        const selected = document.querySelector(`input[name="${q.id}"]:checked`);
        if (selected) ANSWERS[q.id] = selected.value;
        else delete ANSWERS[q.id];
        return;
      }
      if (q.type === 'equipment_checklist') {
        const listEl = document.getElementById(q.id + '_equipment_list');
        const totalEl = document.getElementById(q.id + '_total');
        if (!listEl) return;
        const selected = Array.from(listEl.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.checked);
        const selectedNames = selected.map(cb => cb.value);
        const total = selected.reduce((sum, cb) => sum + Number(cb.getAttribute('data-price') || 0), 0);
        if (selectedNames.length) ANSWERS[q.id + '_items'] = JSON.stringify(selectedNames);
        else delete ANSWERS[q.id + '_items'];
        if (selectedNames.length) {
          ANSWERS[q.id] = String(total);
          ANSWERS[q.id + '_total'] = total || '';
          if (totalEl) totalEl.value = total || '';
        } else {
          delete ANSWERS[q.id];
          delete ANSWERS[q.id + '_total'];
          if (totalEl) totalEl.value = '';
        }
        return;
      }
      if (q.type === 'equipment_dropdown') {
        const equipmentDropdownIds = window.getEquipmentDropdownIds || getEquipmentDropdownIds;
        const ids = equipmentDropdownIds(q.id);
        const typeEl = document.getElementById(ids.typeId);
        const nameEl = document.getElementById(ids.nameId);
        const totalEl = document.getElementById(ids.totalId);
        if (typeEl) ANSWERS[ids.typeId] = typeEl.value;
        if (nameEl) ANSWERS[ids.nameId] = nameEl.value;
        const selectedOption = nameEl && nameEl.selectedOptions ? nameEl.selectedOptions[0] : null;
        if (selectedOption) {
          ANSWERS[q.id + '_name'] = selectedOption.value;
          ANSWERS[q.id] = String(Number(selectedOption.getAttribute('data-price') || 0));
          if (totalEl) totalEl.value = ANSWERS[q.id];
          ANSWERS[q.id + '_total'] = ANSWERS[q.id];
        } else {
          delete ANSWERS[q.id + '_name'];
          delete ANSWERS[q.id];
          delete ANSWERS[q.id + '_total'];
          if (totalEl) totalEl.value = '';
        }
        return;
      }
      if (q.type === 'solvent_calculator') {
        const totalEl = document.getElementById(q.id + '_total');
        if (totalEl) ANSWERS[q.id] = totalEl.value;
        return;
      }
      if (q.type === 'recurring_cost_calculator') {
        const ids = getRecurringCostIds(q.id);
        const columnTypeEl = document.getElementById(ids.columnTypeId);
        const columnNameEl = document.getElementById(ids.columnNameId);
        const runEl = document.getElementById(q.id + '_run');
        const flowEl = document.getElementById(q.id + '_flow');
        const totalEl = document.getElementById(q.id + '_total');
        const mix = getRecurringMix(q.id);
        if (columnTypeEl) ANSWERS[ids.columnTypeId] = columnTypeEl.value;
        if (columnNameEl) ANSWERS[ids.columnNameId] = columnNameEl.value;
        if (runEl) ANSWERS[q.id + '_run'] = runEl.value;
        if (flowEl) ANSWERS[q.id + '_flow'] = flowEl.value;
        const normalPhaseSolvents = mix.normalPhaseSolvents || [];
        const reversePhaseSolvents = mix.reversePhaseSolvents || [];
        const combinedSolvents = [...normalPhaseSolvents, ...reversePhaseSolvents];
        mix.solvents = combinedSolvents;
        ANSWERS[q.id + '_normal_phase_solvent_entries'] = JSON.stringify(normalPhaseSolvents);
        ANSWERS[q.id + '_reverse_phase_solvent_entries'] = JSON.stringify(reversePhaseSolvents);
        ANSWERS[q.id + '_solvent_entries'] = JSON.stringify(combinedSolvents);
        ANSWERS[q.id + '_buffer_entries'] = JSON.stringify(mix.buffers || []);
        if (totalEl) ANSWERS[q.id] = totalEl.value;
        if (totalEl) ANSWERS[q.id + '_total'] = totalEl.value;
        return;
      }
      if (q.type === 'column_selector') {
        const ids = getColumnSelectorIds(q.id);
        const columnTypeEl = document.getElementById(ids.columnTypeId);
        const columnNameEl = document.getElementById(ids.columnNameId);
        const totalEl = document.getElementById(ids.totalId);
        if (columnTypeEl) ANSWERS[ids.columnTypeId] = columnTypeEl.value;
        if (columnNameEl) ANSWERS[ids.columnNameId] = columnNameEl.value;
        if (totalEl) ANSWERS[q.id] = totalEl.value;
        if (totalEl) ANSWERS[q.id + '_total'] = totalEl.value;
        return;
      }
      if (q.type === 'chem_lookup') {
        const nameEl = document.getElementById(q.id + '_name');
        const priceEl = document.getElementById(q.id + '_price');
        const gramsEl = document.getElementById(q.id + '_grams');
        const totalEl = document.getElementById(q.id + '_total');
        const linkEl = document.getElementById(q.id + '_link');
        if (nameEl) ANSWERS[q.id + '_name'] = nameEl.value;
        if (priceEl) ANSWERS[q.id + '_price'] = priceEl.value;
        if (gramsEl) ANSWERS[q.id + '_grams'] = gramsEl.value;
        if (totalEl) ANSWERS[q.id] = totalEl.value;
        if (totalEl) ANSWERS[q.id + '_total'] = totalEl.value;
        if (linkEl) ANSWERS[q.id + '_link'] = linkEl.getAttribute('href') || '';
      } else {
        const el = document.getElementById(q.id);
        if (el) {
          if (q.type === 'number') {
            ANSWERS[q.id] = el.value !== '' ? el.value : '';
          } else {
            ANSWERS[q.id] = el.value;
          }
        }
      }
    });
  }

  function restoreCurrentTabAnswers() {
    const area = QUESTION_AREAS[currentTab];
    if (!area) return;
    getQuestionsForCurrentView(area).forEach(q => {
      if (q.type === 'label') return;
      if (q.type === 'boolean') {
        const value = ANSWERS[q.id];
        const trueEl = document.getElementById(q.id + '_true');
        const falseEl = document.getElementById(q.id + '_false');
        if (trueEl) trueEl.checked = value === 'true';
        if (falseEl) falseEl.checked = value === 'false';
        return;
      }
      if (q.type === 'equipment_checklist') {
        const listEl = document.getElementById(q.id + '_equipment_list');
        const totalEl = document.getElementById(q.id + '_total');
        if (listEl) {
          let saved = [];
          try { saved = ANSWERS[q.id + '_items'] ? JSON.parse(ANSWERS[q.id + '_items']) : []; } catch (e) { saved = []; }
          listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = saved.includes(cb.value);
          });
        }
        if (totalEl && ANSWERS[q.id + '_total'] !== undefined) totalEl.value = ANSWERS[q.id + '_total'];
        return;
      }
      if (q.type === 'equipment_dropdown') {
        const equipmentDropdownIds = window.getEquipmentDropdownIds || getEquipmentDropdownIds;
        const ids = equipmentDropdownIds(q.id);
        const typeEl = document.getElementById(ids.typeId);
        const nameEl = document.getElementById(ids.nameId);
        const totalEl = document.getElementById(ids.totalId);
        if (typeEl && ANSWERS[ids.typeId] !== undefined) {
          typeEl.value = ANSWERS[ids.typeId];
          populateInstrumentNames(q.id, ANSWERS[ids.typeId], ids);
        }
        if (nameEl && ANSWERS[ids.nameId] !== undefined) nameEl.value = ANSWERS[ids.nameId];
        if (totalEl && ANSWERS[q.id + '_total'] !== undefined) totalEl.value = ANSWERS[q.id + '_total'];
        updateInstrumentDropdownTotal(q.id, ids);
        return;
      }
      if (q.type === 'solvent_calculator') {
        const totalEl = document.getElementById(q.id + '_total');
        if (totalEl && ANSWERS[q.id] !== undefined) totalEl.value = ANSWERS[q.id];
        return;
      }
      if (q.type === 'recurring_cost_calculator') {
        const ids = getRecurringCostIds(q.id);
        const mix = getRecurringMix(q.id);
        const savedNormal = parseRecurringEntries(ANSWERS[q.id + '_normal_phase_solvent_entries']);
        const savedReverse = parseRecurringEntries(ANSWERS[q.id + '_reverse_phase_solvent_entries']);
        const legacySolvents = parseRecurringEntries(ANSWERS[q.id + '_solvent_entries']);
        mix.normalPhaseSolvents = savedNormal.length ? savedNormal : (legacySolvents.length ? legacySolvents : []);
        mix.reversePhaseSolvents = savedReverse.length ? savedReverse : [];
        mix.buffers = parseRecurringEntries(ANSWERS[q.id + '_buffer_entries']);
        mix.solvents = [...mix.normalPhaseSolvents, ...mix.reversePhaseSolvents];
        const columnTypeEl = document.getElementById(ids.columnTypeId);
        const columnNameEl = document.getElementById(ids.columnNameId);
        const runEl = document.getElementById(q.id + '_run');
        const flowEl = document.getElementById(q.id + '_flow');
        const totalEl = document.getElementById(q.id + '_total');
        if (columnTypeEl && ANSWERS[ids.columnTypeId] !== undefined) {
          columnTypeEl.value = ANSWERS[ids.columnTypeId];
          populateColumnNames(q.id, ANSWERS[ids.columnTypeId]);
        }
        if (columnNameEl && ANSWERS[ids.columnNameId] !== undefined) {
          columnNameEl.value = ANSWERS[ids.columnNameId];
        }
        if (runEl && ANSWERS[q.id + '_run'] !== undefined) runEl.value = ANSWERS[q.id + '_run'];
        if (flowEl && ANSWERS[q.id + '_flow'] !== undefined) flowEl.value = ANSWERS[q.id + '_flow'];
        renderRecurringList(q.id, 'normal_phase_solvent');
        renderRecurringList(q.id, 'reverse_phase_solvent');
        renderRecurringList(q.id, 'buffer');
        if (totalEl && ANSWERS[q.id] !== undefined) totalEl.value = ANSWERS[q.id];
        updateRecurringCostTotal(q.id);
        return;
      }
      if (q.type === 'column_selector') {
        const ids = getColumnSelectorIds(q.id);
        const columnTypeEl = document.getElementById(ids.columnTypeId);
        const columnNameEl = document.getElementById(ids.columnNameId);
        const totalEl = document.getElementById(ids.totalId);
        if (columnTypeEl && ANSWERS[ids.columnTypeId] !== undefined) {
          columnTypeEl.value = ANSWERS[ids.columnTypeId];
          populateColumnNames(q.id, ANSWERS[ids.columnTypeId], ids);
        }
        if (columnNameEl && ANSWERS[ids.columnNameId] !== undefined) columnNameEl.value = ANSWERS[ids.columnNameId];
        if (totalEl && ANSWERS[q.id] !== undefined) totalEl.value = ANSWERS[q.id];
        updateColumnSelectorTotal(q.id);
        return;
      }
      if (q.type === 'chem_lookup') {
        const nameEl = document.getElementById(q.id + '_name');
        const priceEl = document.getElementById(q.id + '_price');
        const gramsEl = document.getElementById(q.id + '_grams');
        const totalEl = document.getElementById(q.id + '_total');
        const linkEl = document.getElementById(q.id + '_link');
        if (nameEl && ANSWERS[q.id + '_name'] !== undefined) nameEl.value = ANSWERS[q.id + '_name'];
        if (priceEl && ANSWERS[q.id + '_price'] !== undefined) priceEl.value = ANSWERS[q.id + '_price'];
        if (gramsEl && ANSWERS[q.id + '_grams'] !== undefined) gramsEl.value = ANSWERS[q.id + '_grams'];
        if (totalEl && ANSWERS[q.id + '_total'] !== undefined) totalEl.value = ANSWERS[q.id + '_total'];
        if (linkEl && ANSWERS[q.id + '_link']) {
          linkEl.href = ANSWERS[q.id + '_link'];
          linkEl.classList.remove('hidden');
        } else if (linkEl) {
          linkEl.classList.add('hidden');
        }
      } else {
        const el = document.getElementById(q.id);
        if (el && ANSWERS[q.id] !== undefined) {
          el.value = ANSWERS[q.id];
        }
      }
    });
    area.questions.forEach(q => {
      if (q.type === 'chem_lookup') updateChemLookupTotal(q.id);
    });
  }

  function navigateView(direction) {
    saveCurrentTabAnswers();
    const area = QUESTION_AREAS[currentTab];
    if (isFixedCostsArea(area)) {
      if (direction > 0 && fixedCostsSubTab < FIXED_COST_SUBTABS.length - 1) {
        fixedCostsSubTab += 1;
      } else if (direction < 0 && fixedCostsSubTab > 0) {
        fixedCostsSubTab -= 1;
      } else {
        currentTab += direction;
        if (currentTab < 0) currentTab = 0;
        if (currentTab >= QUESTION_AREAS.length) currentTab = QUESTION_AREAS.length - 1;
        const nextArea = QUESTION_AREAS[currentTab];
        if (isFixedCostsArea(nextArea)) fixedCostsSubTab = direction > 0 ? 0 : FIXED_COST_SUBTABS.length - 1;
      }
    } else {
      currentTab += direction;
      if (currentTab < 0) currentTab = 0;
      if (currentTab >= QUESTION_AREAS.length) currentTab = QUESTION_AREAS.length - 1;
      const nextArea = QUESTION_AREAS[currentTab];
      if (isFixedCostsArea(nextArea)) fixedCostsSubTab = direction > 0 ? 0 : FIXED_COST_SUBTABS.length - 1;
    }
    renderTabs();
    renderQuestions();
    updateSectionTitle();
    updateProgress();
    updateNavButtons();
    checkFormValidity();
  }

  function goToTab(idx) {
    saveCurrentTabAnswers();
    currentTab = idx;
    if (isFixedCostsArea(QUESTION_AREAS[currentTab])) fixedCostsSubTab = 0;
    renderTabs();
    renderQuestions();
    updateSectionTitle();
    updateProgress();
    updateNavButtons();
    checkFormValidity();
  }

  Object.defineProperties(window, {
    saveCurrentTabAnswers: { value: saveCurrentTabAnswers, configurable: true },
    restoreCurrentTabAnswers: { value: restoreCurrentTabAnswers, configurable: true },
    navigateView: { value: navigateView, configurable: true },
    goToTab: { value: goToTab, configurable: true }
  });
}());
