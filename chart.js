// chart.js
// Renders a dynamic SVG results graphic with 3D diamond/crystal nodes and a center score ring
// Exported as window.renderResultsGraphic

function renderResultsGraphic(scores) {
  // --- CONFIG ---
  const containerId = 'results-graphic';
  const width = 1200;
  const height = 1000;
  const cx = width / 2;
  const cy = height / 2;
  // Dynamically set node orbit radius to fill space based on n
  const minOrbit = 260;
  const maxOrbit = 400;
  const nodeOrbit = Math.max(minOrbit, Math.min(maxOrbit, Math.floor(Math.min(cx, cy) - 160)));
  const fontFamily = `Roboto, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, 'Noto Sans', sans-serif`;
  const labelFontSize = 18 * 1.2;
  const labelColor = '#1e293b';
  const scoreFontSize = 42 * 1.2;
  const scoreFontWeight = 700;
  const centerScoreFontSize = 58 * 1.2;
  const centerScoreFontWeight = 400;
  const avgLabelFontSize = 14 * 1.2;
  const avgLabelFontWeight = 700;

  // --- DATA ---
  const keys = Object.keys(scores);
  const values = keys.map(k => Number(scores[k]) || 0);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / (values.length || 1));
  const n = keys.length;
  if (!n) return;

  // --- Node color id ---
  function getNodeId(score) {
    if (score >= 70) return 'node-green';
    if (score >= 40) return 'node-yellow';
    return 'node-red';
  }

  // --- Ring gradient ---
  function getRingGradient(avg) {
    if (avg >= 70) return 'url(#ring-green)';
    if (avg >= 40) return 'url(#ring-yellow)';
    return 'url(#ring-red)';
  }

  // --- SVG ---
  let svg = '';
  svg += `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <defs>
      <linearGradient id="ring-green" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#28a745" />
        <stop offset="100%" stop-color="#b6e7c9" />
      </linearGradient>
      <linearGradient id="ring-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fbb02d" />
        <stop offset="100%" stop-color="#fff3cd" />
      </linearGradient>
      <linearGradient id="ring-red" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#dc3545" />
        <stop offset="100%" stop-color="#f8d7da" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#000000" flood-opacity="0.12" />
      </filter>
      <g id="node-green">
        <polygon points="-70,-105 70,-105 0,-15" fill="#48c764" stroke="#48c764" stroke-width="1" />
        <polygon points="70,-105 120,-10 0,120 0,-15" fill="#28a745" stroke="#28a745" stroke-width="1" />
        <polygon points="-70,-105 -120,-10 0,120 0,-15" fill="#1b8535" stroke="#1b8535" stroke-width="1" />
      </g>
      <g id="node-yellow">
        <polygon points="-70,-105 70,-105 0,-15" fill="#ffd859" stroke="#ffd859" stroke-width="1" />
        <polygon points="70,-105 120,-10 0,120 0,-15" fill="#fbb02d" stroke="#fbb02d" stroke-width="1" />
        <polygon points="-70,-105 -120,-10 0,120 0,-15" fill="#df9516" stroke="#df9516" stroke-width="1" />
      </g>
      <g id="node-red">
        <polygon points="-70,-105 70,-105 0,-15" fill="#ef5b68" stroke="#ef5b68" stroke-width="1" />
        <polygon points="70,-105 120,-10 0,120 0,-15" fill="#dc3545" stroke="#dc3545" stroke-width="1" />
        <polygon points="-70,-105 -120,-10 0,120 0,-15" fill="#ba2231" stroke="#ba2231" stroke-width="1" />
      </g>
    </defs>
  `;

  // --- Nodes ---
  for (let i = 0; i < n; ++i) {
    const angle = (360 / n) * i - 90;
    const rad = (angle * Math.PI) / 180;
    const nodeX = cx + nodeOrbit * Math.cos(rad);
    const nodeY = cy + nodeOrbit * Math.sin(rad);
    const score = Math.round(values[i]);
    const nodeId = getNodeId(score);
    // Rotate node so it points toward the center
    const nodeRotation = angle + 90;
    svg += `
      <g transform="translate(${nodeX}, ${nodeY}) rotate(${nodeRotation})" filter="url(#shadow)">
        <use href="#${nodeId}" />
      </g>
      <text x="${nodeX}" y="${nodeY + 18}" text-anchor="middle" dominant-baseline="middle" font-size="${scoreFontSize}" font-family="${fontFamily}" font-weight="${scoreFontWeight}" fill="#fff">${score}</text>
    `;
    // Label
    const labelDist = nodeOrbit + 110;
    const labelX = cx + labelDist * Math.cos(rad);
    const labelY = cy + labelDist * Math.sin(rad);
    svg += `
      <text x="${labelX}" y="${labelY + 8}" text-anchor="middle" dominant-baseline="middle" font-size="${labelFontSize}" font-family="${fontFamily}" font-weight="700" fill="${labelColor}" style="pointer-events:none;">${keys[i]}</text>
    `;
  }

  // --- Center ring ---
  const outerR = 88 * 1.2;
  const innerR = 74 * 1.2;
  svg += `
    <g filter="url(#shadow)">
      <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="${getRingGradient(avg)}" />
      <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#ffffff" />
    </g>
    <text x="${cx}" y="${cy - 25 * 1.2}" text-anchor="middle" font-size="${avgLabelFontSize}" font-family="${fontFamily}" font-weight="${avgLabelFontWeight}" fill="#2d3748">OVERALL</text>
    <text x="${cx}" y="${cy - 7 * 1.2}" text-anchor="middle" font-size="${avgLabelFontSize}" font-family="${fontFamily}" font-weight="${avgLabelFontWeight}" fill="#2d3748">AVERAGE SCORE</text>
    <text x="${cx}" y="${cy + 45 * 1.2}" text-anchor="middle" font-size="${centerScoreFontSize}" font-family="${fontFamily}" font-weight="${centerScoreFontWeight}" fill="#1a202c">${avg}</text>
  `;

  svg += '</svg>';

  // --- Inject ---
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = svg;
  }
}

window.renderResultsGraphic = renderResultsGraphic;
