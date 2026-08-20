(function () {
  async function extractPdfText(file) {
    if (!file || file.type !== 'application/pdf') {
      throw new Error('Please choose a PDF file.');
    }
    if (!window.pdfjsLib) throw new Error('PDF text extraction is not ready yet. Please try again.');

    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str || '').join(' '));
    }
    const text = pages.join('\n\n').replace(/\s+/g, ' ').trim();
    console.info('[PharmaScore] PDF text extracted:', { pages: pdf.numPages, characters: text.length });
    if (!text) throw new Error('No selectable text was found in this PDF. Scanned image PDFs are not supported.');
    return text;
  }

  async function fillQuestionnaireFromPdf(file, questionnaire) {
    const text = await extractPdfText(file);
    return window.requestQuestionnaireFill(text, questionnaire);
  }

  Object.defineProperties(window, {
    extractPdfText: { value: extractPdfText, configurable: true },
    fillQuestionnaireFromPdf: { value: fillQuestionnaireFromPdf, configurable: true }
  });
}());
