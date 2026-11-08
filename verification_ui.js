// verification_ui.js - Browser side UI for PharmaScore verification
// ---------------------------------------------------------------
// This script is completely independent of the main application UI.
// It works with verification.html which provides a simple form.

// PDF.js is loaded via CDN in verification.html (pdfjsLib global)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const txt = await page.getTextContent();
    const pageString = txt.items.map(item => item.str).join('');
    fullText += pageString + '\n';
  }
  return fullText.trim();
}

async function sendToWorker(endpoint, pdfText, questionnaire = {}) {
  const payload = {
    action: 'fill_questionnaire',
    pdfText,
    questionnaire // empty object if you don't have a schema to send
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Worker response ${response.status}: ${err}`);
  }
  return response.json();
}

function addResultRow({ fileName, run, status, duration, confidence, details }) {
  const tbody = document.querySelector('#results tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${fileName}</td>
    <td>${run}</td>
    <td>${status}</td>
    <td>${duration !== undefined ? duration : ''}</td>
    <td>${confidence || ''}</td>
    <td>${details}</td>
  `;
  tbody.appendChild(tr);
}

document.getElementById('startBtn').addEventListener('click', async () => {
  const filesInput = document.getElementById('pdfFiles');
  const runs = parseInt(document.getElementById('runs').value, 10) || 1;
  const delay = parseInt(document.getElementById('delay').value, 10) || 0;
  const WORKER_ENDPOINT = 'https://pharmascore-worker.example.workers.dev';

  if (!filesInput.files.length) {
    alert('Please select at least one PDF file.');
    return;
  }
  if (!WORKER_ENDPOINT) {
    alert('Worker endpoint is not configured.');
    return;
  }
    alert('Please provide the worker endpoint URL.');
    return;
  }

  document.getElementById('results').hidden = false;
  // Clear previous results
  document.querySelector('#results tbody').innerHTML = '';

  const files = Array.from(filesInput.files);
  for (const file of files) {
    const fileName = file.name;
    let pdfText;
    try {
      pdfText = await getPdfText(file);
    } catch (e) {
      addResultRow({ fileName, run: '-', status: '❌ PDF read error', details: e.message });
      continue;
    }

    for (let i = 1; i <= runs; i++) {
      try {
        const start = performance.now();
        const resp = await sendToWorker(endpoint, pdfText);
        const duration = Math.round(performance.now() - start);
        const confidence = resp.confidence || '';
        addResultRow({
          fileName,
          run: i,
          status: '✅ Success',
          duration,
          confidence,
          details: JSON.stringify(resp.questionnaire?.answers || {}, null, 2)
        });
      } catch (err) {
        addResultRow({
          fileName,
          run: i,
          status: '❌ Error',
          details: err.message
        });
      }
      if (delay > 0 && i < runs) await sleep(delay);
    }
  }
});
