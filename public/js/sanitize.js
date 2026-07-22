// ============================================
// PokeCloud HTML Sanitization Utility
// Prevent XSS in dynamic content
// ============================================

function escHtml(str) {
  if (!str) return '';
  str = String(str);
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}
