(function () {
  const state = {
    files: [],
    rows: [],
    questions: []
  };

  function getElement(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
    const status = getElement('csv-verify-status');
    if (status) status.textContent = message;
  }

  function renderResults() {
    const container = getElement('csv-verify-results');
    if (!container) return;
    if (!state.rows.length) {
      container.innerHTML = '';
      return;
    }

    const questionHeaders = state.questions.map(question => `<th title="${escapeHtml(question.id)}">${escapeHtml(question.text)}</th>`).join('');
    container.innerHTML = `
      <table>
        <thead><tr><th>File</th><th>Run</th><th>Status</th><th>Confidence</th><th>Details</th>${questionHeaders}</tr></thead>
        <tbody>
          ${state.rows.map(row => `
            <tr>
              <td>${escapeHtml(row.file)}</td>
              <td>${row.run}</td>
              <td>${escapeHtml(row.status)}</td>
              <td>${escapeHtml(row.confidence || '')}</td>
              <td>${escapeHtml(row.error || (row.unfilled.length ? `Unfilled: ${row.unfilled.join(', ')}` : ''))}</td>
              ${state.questions.map(question => `<td>${escapeHtml(row.readableAnswers[question.id] || '')}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function addPendingRow(file, run) {
    const row = {
      file, run, status: 'Running', confidence: '',
      unfilled: [], answers: {}, readableAnswers: makeReadableAnswers({}), error: ''
    };
    state.rows.push(row);
    renderResults();
    return row;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function questionnaireForVerification() {
    if (!Array.isArray(window.QUESTION_AREAS) || !window.QUESTION_AREAS.length) {
      throw new Error('The questionnaire is still loading. Please wait and try again.');
    }
    if (typeof window.buildQuestionnaireJson !== 'function') {
      throw new Error('The questionnaire export module is not ready. Please reload the page.');
    }
    const questionnaire = window.buildQuestionnaireJson();
    state.questions = questionnaire.questions || [];
    return questionnaire;
  }

  function parseJson(value) {
    if (typeof value !== 'string' || !value.trim()) return value;
    try { return JSON.parse(value); } catch { return value; }
  }

  function readableValue(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.map(item => readableValue(item)).filter(Boolean).join('; ');
    if (typeof value === 'object') {
      return Object.entries(value)
        .filter(([, item]) => item !== null && item !== undefined && item !== '')
        .map(([key, item]) => `${key}: ${readableValue(item)}`)
        .join('; ');
    }
    return String(value);
  }

  function formatAnswer(question, answers) {
    const id = question.id;
    const value = answers[id];
    if (question.type === 'label') return '';
    if (question.type === 'equipment_dropdown' || question.type === 'column_selector') {
      const structured = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const name = structured.name || answers[`${id}_name`] || (typeof value === 'string' ? value : '');
      const category = structured.category || answers[`${id}_type`];
      const priceValue = structured.price ?? (typeof value === 'number' ? value : undefined);
      const price = priceValue !== undefined && priceValue !== '' && !Number.isNaN(Number(priceValue))
        ? `Price: ${priceValue} EUR`
        : '';
      return [category && category !== '__other__' ? category : '', name, price]
        .filter(Boolean).join('; ');
    }
    if (question.type === 'equipment_checklist') {
      const items = parseJson(answers[`${id}_items`] || value);
      return readableValue(items);
    }
    if (question.type === 'recurring_cost_calculator') {
      const structured = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const normalSolvents = structured.normalPhaseSolvents || parseJson(answers[`${id}_normal_phase_solvent_entries`]);
      const reverseSolvents = structured.reversePhaseSolvents || parseJson(answers[`${id}_reverse_phase_solvent_entries`]);
      const buffers = structured.buffers || parseJson(answers[`${id}_buffer_entries`]);
      const modifiers = structured.modifiers || parseJson(answers[`${id}_modifier_entries`]);
      const sections = [
        (structured.run ?? answers[`${id}_run`]) && `Run time: ${structured.run ?? answers[`${id}_run`]} min`,
        (structured.flow ?? answers[`${id}_flow`]) && `Flow: ${structured.flow ?? answers[`${id}_flow`]} mL/min`,
        (structured.gradientMode ?? answers[`${id}_gradient_mode`]) &&
          `Mode: ${structured.gradientMode ?? answers[`${id}_gradient_mode`]}`,
        normalSolvents?.length && `Normal-phase solvents: ${readableValue(normalSolvents)}`,
        reverseSolvents?.length && `Reverse-phase solvents: ${readableValue(reverseSolvents)}`,
        buffers?.length && `Buffers: ${readableValue(buffers)}`,
        modifiers?.length && `Modifiers: ${readableValue(modifiers)}`,
        (structured.total ?? (typeof value !== 'object' ? value : undefined)) !== undefined &&
          `Total: ${structured.total ?? value} EUR`
      ];
      return sections.filter(Boolean).join('; ');
    }
    return readableValue(value);
  }

  function makeReadableAnswers(answers) {
    return Object.fromEntries(state.questions.map(question => [question.id, formatAnswer(question, answers)]));
  }

  async function runVerification() {
    const filesInput = getElement('csv-verify-files');
    const files = Array.from(filesInput?.files || []);
    if (!files.length) {
      setStatus('Choose at least one selectable-text PDF.');
      return;
    }
    const runs = Math.min(5, Math.max(1, Number(getElement('csv-verify-runs')?.value) || 1));
    const delay = Math.max(0, Number(getElement('csv-verify-delay')?.value) || 0) * 1000;
    const appSharedSecret = getElement('csv-verify-secret')?.value.trim() || '';
    if (!appSharedSecret) {
      setStatus('Enter the internal verification secret.');
      return;
    }
    const startButton = getElement('csv-verify-start-btn');
    const exportButton = getElement('csv-verify-export-btn');
    if (startButton) startButton.disabled = true;
    if (exportButton) exportButton.disabled = true;
    state.files = files;
    state.rows = [];
    renderResults();

    try {
      const questionnaire = questionnaireForVerification();
      const total = files.length * runs;
      let completed = 0;
      for (const file of files) {
        let text;
        try {
          text = await window.extractPdfText(file);
        } catch (error) {
          for (let run = 1; run <= runs; run += 1) {
            state.rows.push({
              file: file.name, run, status: 'PDF error', confidence: '',
              unfilled: [], answers: {}, readableAnswers: makeReadableAnswers({}), error: error.message
            });
            completed += 1;
          }
          renderResults();
          continue;
        }

        for (let run = 1; run <= runs; run += 1) {
          setStatus(`Starting ${completed + 1} of ${total}: ${file.name} (run ${run}/${runs})`);
          const currentRow = addPendingRow(file.name, run);
          try {
            setStatus(`Security check for ${file.name} (run ${run}/${runs})...`);
            const result = await window.requestQuestionnaireFill(text, questionnaire, {
              internalVerification: true,
              appSharedSecret
            });
            if (!result.success) throw new Error(result.error || 'Verification request failed.');
            currentRow.status = 'Success';
            currentRow.confidence = result.confidence || '';
            currentRow.unfilled = result.unfilled || [];
            currentRow.answers = result.questionnaire?.answers || {};
            currentRow.readableAnswers = makeReadableAnswers(currentRow.answers);
            setStatus(`Completed ${completed + 1} of ${total}: ${file.name} (run ${run}/${runs})`);
          } catch (error) {
            currentRow.status = 'Error';
            currentRow.error = error.message;
            setStatus(`Failed ${completed + 1} of ${total}: ${file.name} - ${error.message}`);
          }
          completed += 1;
          renderResults();
          if (run < runs && delay) {
            setStatus(`Waiting before the next request (${Math.ceil(delay / 1000)} seconds)...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      setStatus(`Completed ${completed} verification run${completed === 1 ? '' : 's'}.`);
      if (exportButton) exportButton.disabled = !state.rows.length;
    } catch (error) {
      setStatus(error.message);
    } finally {
      if (startButton) startButton.disabled = false;
    }
  }

  function csvCell(value) {
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportResults() {
    if (!state.rows.length) return;
    const questions = state.questions;
    const headers = ['file', 'run', 'status', 'confidence', 'unfilled', 'error', ...questions.map(question => question.text)];
    const lines = [headers.map(csvCell).join(',')];
    state.rows.forEach(row => {
      lines.push([
        row.file, row.run, row.status, row.confidence,
        row.unfilled.join('; '), row.error,
        ...questions.map(question => row.readableAnswers[question.id])
      ].map(csvCell).join(','));
    });
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pharmascore_verification_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function setup() {
    const panel = getElement('csv-verify-panel');
    const openButton = getElement('csv-verify-open-btn');
    const closeButton = getElement('csv-verify-close-btn');
    if (!panel || !openButton || !closeButton) return;
    openButton.classList.remove('hidden');
    openButton.addEventListener('click', () => {
      panel.classList.remove('hidden');
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    closeButton.addEventListener('click', () => panel.classList.add('hidden'));
    getElement('csv-verify-start-btn')?.addEventListener('click', runVerification);
    getElement('csv-verify-export-btn')?.addEventListener('click', exportResults);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
}());
