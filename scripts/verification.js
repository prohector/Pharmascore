// Verification automation script for PharmaScore
// ---------------------------------------------------
// This script is completely independent of the web UI. It reads one or more PDF files,
// sends them to the Cloudflare Worker endpoint, repeats the request to measure
// consistency, and saves the collected scores/results.
//
// Usage (Node.js):
//   node scripts/verification.js --files "pdfs/*.pdf" --runs 3 --delay 2000 --url http://127.0.0.1:8787
//
// Options:
//   --files   Glob pattern or comma‑separated list of PDF paths (required)
//   --runs    Number of times each PDF should be processed (default: 1)
//   --delay   Milliseconds to wait between runs to avoid rate limits (default: 0)
//   --url     Worker endpoint URL (required). The endpoint must accept a POST
//             body with `{ action: "fill_questionnaire", pdfText: <string>, questionnaire: <object> }`
//   --out     Output file (JSON) for the aggregated results (default: verification_results.json)
//
// The script uses the `pdf-parse` package for PDF text extraction. Install dependencies:
//   npm install pdf-parse node-fetch glob yargs

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');
const glob = require('glob');
const yargs = require('yargs');

// -------------------- Helper functions --------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractTextFromPdf(filePath) {
  const data = fs.readFileSync(filePath);
  const pdfData = await pdfParse(data);
  return pdfData.text.trim();
}

async function sendToWorker(url, pdfText, questionnaire) {
  const payload = {
    action: 'fill_questionnaire',
    pdfText,
    questionnaire // could be an empty object if the worker can fetch a default schema
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Worker responded ${response.status}: ${err}`);
  }
  return response.json();
}

// -------------------- Main script --------------------
(async () => {
  const argv = yargs
    .option('files', { type: 'string', demandOption: true, describe: 'Glob pattern or comma‑separated list of PDF files' })
    .option('runs', { type: 'number', default: 1, describe: 'How many times to process each PDF' })
    .option('delay', { type: 'number', default: 0, describe: 'Delay (ms) between runs' })
    .option('url', { type: 'string', demandOption: true, describe: 'Cloudflare Worker endpoint URL' })
    .option('out', { type: 'string', default: 'verification_results.json', describe: 'File to write aggregated results' })
    .help()
    .argv;

  // Resolve file list
  let files = [];
  const list = argv.files.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  for (const pattern of list) {
    const matches = glob.sync(pattern);
    files.push(...matches);
  }
  files = Array.from(new Set(files)); // deduplicate

  if (files.length === 0) {
    console.error('No PDF files matched the provided pattern(s).');
    process.exit(1);
  }

  console.log(`Found ${files.length} PDF file(s). Starting verification…`);

  const results = [];

  // Placeholder questionnaire – you can replace this with the actual schema if needed.
  const dummyQuestionnaire = {};

  for (const file of files) {
    console.log(`\nProcessing: ${path.basename(file)}`);
    const pdfText = await extractTextFromPdf(file);

    for (let i = 1; i <= argv.runs; i++) {
      console.log(` Run ${i}/${argv.runs}…`);
      try {
        const start = Date.now();
        const resp = await sendToWorker(argv.url, pdfText, dummyQuestionnaire);
        const duration = Date.now() - start;
        results.push({
          file: path.basename(file),
          run: i,
          timestamp: new Date().toISOString(),
          durationMs: duration,
          success: true,
          response: resp // contains the questionnaire answers and confidence
        });
        console.log('  ✅ Success');
      } catch (err) {
        console.error('  ❌ Error:', err.message);
        results.push({
          file: path.basename(file),
          run: i,
          timestamp: new Date().toISOString(),
          success: false,
          error: err.message
        });
      }
      if (argv.delay > 0 && i < argv.runs) await sleep(argv.delay);
    }
  }

  // Write results to output file
  fs.writeFileSync(argv.out, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nVerification finished. Results written to ${argv.out}`);
})();
