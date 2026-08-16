(function () {
  function parseCSV(csv) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const normalized = String(csv || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (inQuotes) {
        if (char === '"') {
          if (normalized[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    const headers = (rows[0] || []).map(h => String(h || '').trim());
    return rows.slice(1)
      .filter(r => Array.isArray(r) && r.some(cell => String(cell || '').trim() !== ''))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = String(r[idx] || '').trim();
        });
        return obj;
      });
  }

  function parseNamedCsvRows(csvText) {
    const rows = parseCSV(csvText);
    return rows
      .map(row => ({
        ...row,
        price: row.price !== undefined && row.price !== '' ? Number(row.price) : NaN,
        type: row.type || row.group || 'Other',
        phase: row.phase || row.Phase || row.section || 'Other'
      }))
      .filter(row => row.name && !isNaN(row.price));
  }

  function parseColumnsCsv(csvText) {
    const rows = parseCSV(csvText);
    return rows.map(row => {
      const priceSource = row['Price (avg)'] || row.price || row.Price || '';
      const priceStr = String(priceSource).trim();
      const priceMatch = priceStr.match(/([\d.]+)\s*€/i) || priceStr.match(/([\d.]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : NaN;
      const type = (row.Type || row.type || row['Column Type'] || '').trim();
      const length = (row.Length || row.length || row['Column length'] || '').trim();
      const diameter = (row.Diameter || row.diameter || row['Column diameter'] || '').trim();
      const fullName = (row['Full name and characteristics'] || row.fullName || row.name || row['Full Name'] || '').trim();
      return {
        type,
        length,
        diameter,
        price,
        fullName
      };
    }).filter(row => row.type && row.fullName && !isNaN(row.price));
  }

  function getColumnTypes(columns) {
    const types = [...new Set(columns.map(c => c.type).filter(Boolean))];
    return types.sort((a, b) => a.localeCompare(b));
  }

  function getColumnsByType(columns, type) {
    return columns.filter(c => String(c.type) === String(type));
  }

  async function loadQuestionsFromCSV() {
    const loadingMsg = document.getElementById('loading-message');
    const errorMsg = document.getElementById('error-message');

    try {
      const cacheBuster = `t=${Date.now()}`;
      const [questionsResult, solventsResult, columnsResult, buffersResult, auxiliaryResult, samplePretreatmentResult, instrumentsResult, sampleAnalysisResultsResult] = await Promise.allSettled([
        fetch(`config/questions.csv?${cacheBuster}`, { cache: 'no-store' }),
        fetch(`config/solvents.csv?${cacheBuster}`, { cache: 'no-store' }),
        fetch(`config/columns.csv?${cacheBuster}`, { cache: 'no-store' }),
        fetch(`config/buffers.csv?${cacheBuster}`, { cache: 'no-store' }),
        fetch(`config/auxiliary_equipment.csv?${cacheBuster}`, { cache: 'no-store' }),
        fetch(`config/sample_pretreatment_equipment.csv?${cacheBuster}`, { cache: 'no-store' }),
        fetch(`config/instruments.csv?${cacheBuster}`, { cache: 'no-store' }),
        fetch(`config/sample_analysis_results.csv?${cacheBuster}`, { cache: 'no-store' })
      ]);

      const questionsRes = questionsResult.status === 'fulfilled' ? questionsResult.value : null;
      const solventsRes = solventsResult.status === 'fulfilled' ? solventsResult.value : null;
      const columnsRes = columnsResult.status === 'fulfilled' ? columnsResult.value : null;
      const buffersRes = buffersResult.status === 'fulfilled' ? buffersResult.value : null;
      const auxiliaryRes = auxiliaryResult.status === 'fulfilled' ? auxiliaryResult.value : null;
      const samplePretreatmentRes = samplePretreatmentResult.status === 'fulfilled' ? samplePretreatmentResult.value : null;

      if (!questionsRes || !questionsRes.ok) throw new Error('Question file not found');
      if (!solventsRes || !solventsRes.ok) throw new Error('Solvent file not found');
      if (!columnsRes || !columnsRes.ok) throw new Error('Column file not found');
      if (!buffersRes || !buffersRes.ok) throw new Error('Buffer file not found');

      const [csvText, solventsText, columnsText, buffersText, auxiliaryText, samplePretreatmentText, instrumentsText, sampleAnalysisResultsText] = await Promise.all([
        questionsRes.text(),
        solventsRes.text(),
        columnsRes.text(),
        buffersRes.text(),
        auxiliaryRes && auxiliaryRes.ok ? auxiliaryRes.text() : '',
        samplePretreatmentRes && samplePretreatmentRes.ok ? samplePretreatmentRes.text() : '',
        instrumentsResult && instrumentsResult.status === 'fulfilled' && instrumentsResult.value && instrumentsResult.value.ok ? instrumentsResult.value.text() : '',
        sampleAnalysisResultsResult && sampleAnalysisResultsResult.status === 'fulfilled' && sampleAnalysisResultsResult.value && sampleAnalysisResultsResult.value.ok ? sampleAnalysisResultsResult.value.text() : ''
      ]);

      window.SOLVENT_OPTIONS = parseNamedCsvRows(solventsText);
      window.COLUMN_OPTIONS = parseColumnsCsv(columnsText);
      window.BUFFER_OPTIONS = parseNamedCsvRows(buffersText);
      window.AUXILIARY_EQUIPMENT_OPTIONS = parseNamedCsvRows(auxiliaryText).map(item => ({
        ...item,
        category: item.category || item.group || item.section || 'Other'
      }));
      window.SAMPLE_PRETREATMENT_EQUIPMENT_OPTIONS = parseNamedCsvRows(samplePretreatmentText).map(item => ({
        ...item,
        category: item.category || item.group || item.section || 'Other'
      }));
      window.SAMPLE_ANALYSIS_RESULTS_OPTIONS = parseCSV(sampleAnalysisResultsText).map(row => {
        const sample = row.sample || row.matrix || row.substrate || row.name || '';
        const difficulty = Number(row.difficulty ?? row.score ?? row.value ?? 0) || 0;
        return {
          sample,
          difficulty,
          value: String(difficulty),
          label: `${sample}${difficulty ? ` — ${difficulty}` : ''}`
        };
      }).filter(item => item.sample);

      try {
        if (instrumentsText && instrumentsText.trim()) {
          const rows = parseCSV(instrumentsText);
          window.INSTRUMENT_OPTIONS = rows.map(r => ({
            type: r['Type'] || r['Instrument Type'] || r.type || 'Other',
            name: r['Instrument'] || r['Instrument Type'] || r['Type'] || r.name || '',
            price: Number((r['Average Price (EUR)'] || r['Average Price'] || r.price || '').toString().replace(/[^0-9.\-]/g, ''))
          })).filter(i => i.name && !isNaN(i.price));
        } else {
          window.INSTRUMENT_OPTIONS = [];
        }
      } catch (e) {
        window.INSTRUMENT_OPTIONS = [];
      }

      if (window.COLUMN_OPTIONS.length) {
        console.log('Distinct column types:', getColumnTypes(window.COLUMN_OPTIONS));
      }

      console.groupCollapsed && console.groupCollapsed('Loaded recurring cost sources');
      console.log('Solvents:', window.SOLVENT_OPTIONS);
      console.log('Columns:', window.COLUMN_OPTIONS);
      console.log('Buffers:', window.BUFFER_OPTIONS);
      console.log('Auxiliary equipment:', window.AUXILIARY_EQUIPMENT_OPTIONS);
      console.log('Sample pretreatment equipment:', window.SAMPLE_PRETREATMENT_EQUIPMENT_OPTIONS);
      console.groupEnd && console.groupEnd();

      const allRows = parseCSV(csvText);
      const sectionMap = {};
      allRows.forEach(row => {
        const section = row.section || 'Section';
        if (!sectionMap[section]) sectionMap[section] = [];
        let parsedParams = row.params;
        if (typeof parsedParams === 'string' && parsedParams.trim().length > 0) {
          try {
            parsedParams = JSON.parse(parsedParams);
          } catch {
            parsedParams = row.params;
          }
        }
        sectionMap[section].push({
          ...row,
          params: parsedParams,
          required: String(row.required).toLowerCase() === 'true'
        });
      });

      window.QUESTION_AREAS = Object.entries(sectionMap).map(([section, questions]) => ({
        id: section.toLowerCase().replace(/\s+/g, '_'),
        title: section,
        questions
      }));

      if (!window.QUESTION_AREAS.length) throw new Error('No questions found in CSV.');

      window.SOURCES_LOADED = true;
      window.QUESTIONS_LOADED = true;
      window.QUESTIONS_LOAD_FAILED = false;
      window.QUESTIONS_LOAD_ERROR = '';

      if (loadingMsg) loadingMsg.classList.add('hidden');
      if (errorMsg) errorMsg.classList.add('hidden');

      if (window.showQuestionnaireIfReady) {
        window.showQuestionnaireIfReady();
      }

      if (window.ANALYSIS_GATE_CHOSEN) {
        if (window.renderTabs) window.renderTabs();
        if (window.renderQuestions) window.renderQuestions();
        if (window.updateSectionTitle) window.updateSectionTitle();
        if (window.updateProgress) window.updateProgress();
        if (window.updateNavButtons) window.updateNavButtons();
        if (window.checkFormValidity) window.checkFormValidity();
      }
    } catch (err) {
      window.QUESTIONS_LOADED = false;
      window.QUESTIONS_LOAD_FAILED = true;
      window.QUESTIONS_LOAD_ERROR = 'Failed to load questionnaire: ' + err.message + '\n(If running locally, use Live Server or a local web server)';
      if (loadingMsg) loadingMsg.classList.add('hidden');
      if (errorMsg) {
        errorMsg.textContent = window.QUESTIONS_LOAD_ERROR;
        if (window.ANALYSIS_GATE_CHOSEN) errorMsg.classList.remove('hidden');
      }
      const main = document.querySelector('main');
      if (main) main.classList.add('hidden');
    }
  }

  Object.defineProperties(window, {
    parseCSV: { value: parseCSV, configurable: true },
    parseNamedCsvRows: { value: parseNamedCsvRows, configurable: true },
    parseColumnsCsv: { value: parseColumnsCsv, configurable: true },
    getColumnTypes: { value: getColumnTypes, configurable: true },
    getColumnsByType: { value: getColumnsByType, configurable: true },
    loadQuestionsFromCSV: { value: loadQuestionsFromCSV, configurable: true }
  });

  Object.defineProperties(window, {
    SAMPLE_PRETREATMENT_EQUIPMENT_OPTIONS: {
      get() { return window.__SAMPLE_PRETREATMENT_EQUIPMENT_OPTIONS || []; },
      set(v) { window.__SAMPLE_PRETREATMENT_EQUIPMENT_OPTIONS = v; },
      configurable: true
    }
  });
}());
