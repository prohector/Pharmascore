// Initialization script for PDF.js and API bindings
import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';

try {
  // Browsers disallow cross-origin Worker scripts directly (e.g. from cdnjs).
  // Creating a same-origin Blob URL that imports the worker module bypasses this restriction.
  const workerBlob = new Blob(
    [`import 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';`],
    { type: 'text/javascript' }
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
} catch {
  // If Blob worker creation fails, PDF.js falls back to main-thread fake worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
}

window.pdfjsLib = pdfjsLib;

import { lookupChemicalPrice, requestQuestionnaireFill, getTurnstileToken, resetTurnstile } from './api.js';
window.lookupChemicalPrice = lookupChemicalPrice;
window.requestQuestionnaireFill = requestQuestionnaireFill;
window.getTurnstileToken = getTurnstileToken;
window.resetTurnstile = resetTurnstile;
