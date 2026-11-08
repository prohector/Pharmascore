/**
 * Escape HTML special characters to prevent XSS.
 * Mirrors the existing `esc` function from chart.js.
 * @param {any} value - The value to escape.
 * @returns {string} Escaped string safe for insertion into HTML.
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
