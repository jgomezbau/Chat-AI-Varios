// Estilos CSS para inyectar en la página web
// para mejorar la funcionalidad del portapapeles en los bloques de código

const clipboardStyles = `
/* Estilos para botones de copiado */
[aria-label="Copy code"],
.copy-button,
.code-block-copy-button,
[data-testid="copy-code-button"],
button[class*="copy"],
div[class*="copyButton"] {
  position: relative;
  z-index: 10 !important;
  cursor: pointer !important;
}

/* Indicador visual de éxito de copiado */
[aria-label="Copy code"].copied:after,
.copy-button.copied:after,
.code-block-copy-button.copied:after,
[data-testid="copy-code-button"].copied:after,
button[class*="copy"].copied:after,
div[class*="copyButton"].copied:after {
  content: "Copiado!";
  position: absolute;
  right: 100%;
  top: 0;
  background: #10a37f;
  color: white;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  margin-right: 8px;
  opacity: 1;
  animation: fadeIn 0.3s, fadeOut 0.5s 1s forwards;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Asegurar que los bloques de código sean seleccionables */
.relative pre,
.relative code,
pre, code {
  user-select: text !important;
  -webkit-user-select: text !important;
}

/* Hacer que el botón sea más visible en modo hover */
[aria-label="Copy code"]:hover,
.copy-button:hover,
.code-block-copy-button:hover,
[data-testid="copy-code-button"]:hover,
button[class*="copy"]:hover,
div[class*="copyButton"]:hover {
  opacity: 1 !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
}
`;

// Función para inyectar estilos CSS
function injectStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = clipboardStyles;
  document.head.appendChild(styleElement);
}

module.exports = { clipboardStyles, injectStyles };