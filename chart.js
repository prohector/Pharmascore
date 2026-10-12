// Renders the final assessment using Variation 2: the pyramid badge.
// Exported as window.renderResultsGraphic.

function renderResultsGraphic(scores) {
  const container = document.getElementById('results-graphic');
  if (!container) return;
  const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const scoreFor = key => Math.round(Number(scores[key]) || 0);
  const average = Math.round(Object.values(scores).reduce((sum, value) => sum + (Number(value) || 0), 0) / (Object.keys(scores).length || 1));
  const colorFor = score => score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const categories = [
    { key: 'Green assessment', title: 'NFPA', icon: 'noun_leaf_8158036_@700.png', x: 21.9, y: 27 },
    { key: 'Equipment Fixed Costs', title: 'Equip', icon: 'noun_lab_3020074_@700.png', x: 60, y: 27 },
    { key: 'Analytical Consumables', title: 'Consum', icon: 'noun_Money_8127580_@700.png', x: 98.1, y: 27 },
    { key: 'Practicality', title: 'Practic', icon: 'noun_service_5454640_@700.png', x: 40.9, y: 60 },
    { key: 'Analytical Performance', title: 'Perform', icon: 'noun_performance_831861_@700.png', x: 79.1, y: 60 }
  ];
  const hex = '<polygon points="19.1,11.0 0.0,22.0 -19.1,11.0 -19.1,-11.0 -0.0,-22.0 19.1,-11.0" class="hex-shape" />';
  const node = category => {
    const score = scoreFor(category.key);
    return `<g class="pyramid-cell" data-category="${esc(category.key)}" tabindex="0" role="img" aria-label="${esc(category.key)} score ${score}" transform="translate(${category.x}, ${category.y})">
      ${hex.replace('class="hex-shape"', `class="hex-shape" fill="${colorFor(score)}"`)}
      <image class="pyramid-icon" href="./assets/${category.icon}" x="-8" y="-14" width="16" height="16" preserveAspectRatio="xMidYMid meet" />
      <text class="title" x="0" y="8" text-anchor="middle">${category.title}</text>
      <text class="score" x="0" y="16" text-anchor="middle">${score}</text>
    </g>`;
  };
  container.innerHTML = `<svg class="results-pyramid" viewBox="0 0 120 120" width="100%" height="100%" role="img" aria-label="Assessment score pyramid" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="pyramid-shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.15" /></filter></defs>
    <polygon points="60,2 108,20 115,70 60,118 5,70 12,20" fill="white" stroke="white" stroke-width="6" stroke-linejoin="round" filter="url(#pyramid-shadow)" />
    ${categories.map(node).join('')}
    <g class="pyramid-cell pyramid-overall" data-category="Overall score" tabindex="0" role="img" aria-label="Overall score ${average}" transform="translate(60, 93)">
      ${hex.replace('class="hex-shape"', 'class="hex-shape" fill="#1e293b"')}
      <text class="title overall-title" x="0" y="-2" text-anchor="middle">SCORE</text>
      <text class="overall-score" x="0" y="10" text-anchor="middle">${average}</text>
    </g>
  </svg>`;
}

window.renderResultsGraphic = renderResultsGraphic;

function downloadResultsGraphic(format) {
  const svg = document.querySelector('#results-graphic .results-pyramid');
  if (!svg) return;
  const serialized = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  if (format === 'svg') {
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pharmascore-assessment.svg';
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (format !== 'png') return;
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1200;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pharmascore-assessment.png';
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  image.src = URL.createObjectURL(svgBlob);
}

window.downloadResultsGraphic = downloadResultsGraphic;
