// Este script se inyectará en el contexto web para solucionar problemas de portapapeles
// especialmente en los canvas de ChatGPT

// Script a inyectar
const clipboardFixScript = `
(function() {
  // Función para detectar y parchear el portapapeles en elementos canvas
  function patchCanvasClipboard() {
    // Intentar encontrar todos los botones de copia en los canvas
    const findCopyButtons = () => {
      // Selectores para distintos tipos de botones de copia en la interfaz de ChatGPT
      const selectors = [
        '[aria-label="Copy code"]',
        '.copy-button',
        '.code-block-copy-button',
        '[data-testid="copy-code-button"]',
        'button[class*="copy"]',
        'div[class*="copyButton"]'
      ];
      
      return Array.from(document.querySelectorAll(selectors.join(',')));
    };
    
    // Obtener texto del elemento de código cercano
    const getCodeText = (button) => {
      // Diferentes rutas para encontrar el bloque de código
      let codeBlock = null;
      
      // Buscar el elemento padre con clase 'relative' y luego el código dentro
      const relativeParent = button.closest('.relative');
      if (relativeParent) {
        codeBlock = relativeParent.querySelector('code, pre');
      }
      
      // Si no se encontró, intentar otras estrategias
      if (!codeBlock) {
        // Buscar hermanos pre/code
        const parent = button.parentElement;
        if (parent) {
          codeBlock = parent.querySelector('pre, code');
        }
      }
      
      // Ultima opción: subir dos niveles y buscar
      if (!codeBlock && button.parentElement && button.parentElement.parentElement) {
        codeBlock = button.parentElement.parentElement.querySelector('pre, code');
      }
      
      return codeBlock ? codeBlock.textContent : null;
    };
    
    // Parchar un botón de copia específico
    const patchCopyButton = (button) => {
      if (button && !button.hasAttribute('electron-clipboard-patched')) {
        // Marcar como parchado para evitar duplicados
        button.setAttribute('electron-clipboard-patched', 'true');
        
        // Almacenar el manejador original si existe
        const originalClick = button.onclick;
        
        // Reemplazar con nuestro manejador
        button.onclick = (event) => {
          // Prevenir comportamiento predeterminado
          event.preventDefault();
          event.stopPropagation();
          
          // Obtener el texto del código
          const text = getCodeText(button);
          
          if (text) {
            // Usar la API de Electron para copiar
            if (window.electronAPI && window.electronAPI.copyToClipboard) {
              const success = window.electronAPI.copyToClipboard(text);
              
              // Dar retroalimentación visual
              if (success) {
                // Mostrar algún indicador de éxito si existe
                const successIndicator = button.querySelector('.text-green-500, [class*="success"]');
                if (successIndicator) {
                  successIndicator.style.display = 'inline';
                  setTimeout(() => {
                    successIndicator.style.display = 'none';
                  }, 1500);
                } else {
                  // Mostrar notificación alternativa
                  button.classList.add('copied');
                  setTimeout(() => {
                    button.classList.remove('copied');
                  }, 1500);
                }
              }
            } else {
              // Respaldo usando navigator.clipboard
              navigator.clipboard.writeText(text).catch(err => {
                console.error('Error al copiar texto:', err);
              });
            }
          }
          
          // Llamar al manejador original como respaldo
          if (typeof originalClick === 'function') {
            originalClick.call(button, event);
          }
        };
      }
    };
    
    // Parchar todos los botones encontrados
    const patchAllButtons = () => {
      const buttons = findCopyButtons();
      buttons.forEach(patchCopyButton);
    };
    
    // Ejecutar inicialmente
    patchAllButtons();
    
    // Configurar observador para detectar nuevos botones
    const observer = new MutationObserver((mutations) => {
      let shouldPatch = false;
      
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldPatch = true;
          break;
        }
      }
      
      if (shouldPatch) {
        patchAllButtons();
      }
    });
    
    // Iniciar observación
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Parchar la API del portapapeles nativa
  function patchNativeClipboard() {
    if (navigator.clipboard) {
      // Guardar referencia al método original
      const originalWriteText = navigator.clipboard.writeText;
      
      // Reemplazar con nuestra función
      navigator.clipboard.writeText = async function(text) {
        try {
          // Intentar método nativo primero
          await originalWriteText.call(navigator.clipboard, text);
        } catch (err) {
          console.log('Native clipboard write failed, using Electron API');
          // Intentar con Electron como respaldo
          if (window.electronAPI && window.electronAPI.copyToClipboard) {
            if (!window.electronAPI.copyToClipboard(text)) {
              throw new Error('Failed to copy using Electron API');
            }
          } else {
            throw err; // Re-lanzar si no hay respaldo
          }
        }
      };
    }
  }
  
  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      patchNativeClipboard();
      patchCanvasClipboard();
    });
  } else {
    patchNativeClipboard();
    patchCanvasClipboard();
  }
})();
`;

module.exports = { clipboardFixScript };