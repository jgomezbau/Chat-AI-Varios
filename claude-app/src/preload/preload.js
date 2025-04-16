const { contextBridge, ipcRenderer, clipboard } = require('electron');
const { clipboardFixScript } = require('./clipboard-fix');
const { clipboardStyles, injectStyles } = require('./inject-styles');
const { browserDetectionFixScript } = require('./browser-detection-fix');
const { authFixScript } = require('./auth-fix');

// Función para manejar el copiado al portapapeles
function handleClipboardCopy(text) {
  if (text) {
    try {
      clipboard.writeText(text);
      // Mostrar notificación de éxito
      showNotification('Copiado al portapapeles');
      return true;
    } catch (error) {
      console.error('Error copiando al portapapeles:', error);
      showNotification('Error al copiar', true);
      return false;
    }
  }
  return false;
}

// Función para obtener texto del portapapeles
function handleClipboardRead() {
  try {
    return clipboard.readText();
  } catch (error) {
    console.error('Error leyendo del portapapeles:', error);
    showNotification('Error al leer del portapapeles', true);
    return null;
  }
}

// Función para mostrar notificaciones estilo navegador
function showNotification(message, isError = false) {
  // Solo mostrar si estamos en producción o si es un error
  if (process.env.NODE_ENV !== 'development' || isError) {
    // Crear notificación temporal en el DOM
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 16px;
      background-color: ${isError ? '#f44336' : '#43a047'};
      color: white;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 9999;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.3s, transform 0.3s;
    `;
    document.body.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => {
      notification.style.opacity = "1";
      notification.style.transform = "translateY(0)";
    }, 10);
    
    // Eliminar la notificación después de 3 segundos
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateY(20px)";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Ocultar API de Electron del navegador
// Crear versión segura (no expuesta) para uso interno
const secureElectronAPI = {
  // Funciones de portapapeles
  copyToClipboard: (text) => handleClipboardCopy(text),
  readFromClipboard: () => handleClipboardRead(),
  
  // Funciones de IPC para comunicación con el proceso principal
  invoke: (channel, ...args) => {
    // Lista blanca de canales permitidos
    const validChannels = [
      'clipboard:copy',
      'clipboard:read',
      'dialog:show'
    ];
    
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    
    return Promise.reject(new Error(`Canal no permitido: ${channel}`));
  }
};

// Exponer un mínimo de funciones necesarias bajo un nombre genérico
// Esto reduce la posibilidad de detección como Electron
contextBridge.exposeInMainWorld('clipboardHelper', {
  copy: (text) => secureElectronAPI.copyToClipboard(text),
  read: () => secureElectronAPI.readFromClipboard()
});

// Interceptar e implementar APIs nativas del navegador que podrían no estar disponibles
const chromiumAPIs = {
  // Implementación de APIs típicas de Chrome
  chrome: {
    runtime: {
      getManifest: () => ({}),
      connect: () => ({}),
      sendMessage: () => Promise.resolve()
    },
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve()
      },
      sync: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve()
      }
    },
    permissions: {
      contains: () => Promise.resolve(true),
      request: () => Promise.resolve(true)
    }
  }
};

// Función para inyectar script en la página
function injectScript(script) {
  try {
    const element = document.createElement('script');
    element.textContent = script;
    document.head.appendChild(element);
    element.remove();
    return true;
  } catch (error) {
    console.error('Error al inyectar script:', error);
    return false;
  }
}

// Inyectar parches cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM cargado, iniciando parches');
  
  // Inyectar nuestros estilos CSS
  const styleElement = document.createElement('style');
  styleElement.textContent = clipboardStyles;
  document.head.appendChild(styleElement);
  
  // Inyectar scripts de corrección
  injectScript(clipboardFixScript);
  injectScript(browserDetectionFixScript);
  injectScript(authFixScript);
  
  // Inyectar polyfills para compatibilidad con navegadores modernos
  injectScript(`
    // Parche para navigator.userAgent para simular Chrome
    if (navigator.userAgent.includes('Electron')) {
      Object.defineProperty(navigator, 'userAgent', {
        get: function() {
          return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
        }
      });
    }
    
    // Simular la presencia de la API de Chrome sin revelarse como Electron
    if (!window.chrome) {
      window.chrome = {
        runtime: {
          getManifest: function() { return {}; },
          connect: function() { return {}; },
          sendMessage: function() { return Promise.resolve(); }
        },
        storage: {
          local: {
            get: function() { return Promise.resolve({}); },
            set: function() { return Promise.resolve(); }
          },
          sync: {
            get: function() { return Promise.resolve({}); },
            set: function() { return Promise.resolve(); }
          }
        },
        permissions: {
          contains: function() { return Promise.resolve(true); },
          request: function() { return Promise.resolve(true); }
        }
      };
    }
    
    // Parchar funciones para simular navegador normal
    function patchClipboardAPI() {
      if (navigator.clipboard) {
        const originalWriteText = navigator.clipboard.writeText;
        navigator.clipboard.writeText = async function(text) {
          try {
            // Intentar método nativo primero
            return await originalWriteText.call(navigator.clipboard, text);
          } catch (err) {
            // Usar nuestro helper como respaldo
            if (window.clipboardHelper && window.clipboardHelper.copy) {
              const success = window.clipboardHelper.copy(text);
              if (success) {
                return Promise.resolve();
              }
            }
            // Si todo falla, rechazar la promesa
            return Promise.reject(new Error('Failed to copy text: ' + err.message));
          }
        };
      }
    }
    
    patchClipboardAPI();
    
    // Habilitar DnD en Claude (más compatibilidad con browser)
    document.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
    }, false);
    
    document.addEventListener('drop', function(e) {
      // Permitir drop normal
      if (e.target.tagName === 'INPUT' || e.target.isContentEditable) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      
      // Procesar aquí los archivos si son imágenes para subida
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        // El código nativo de Claude debería poder manejar esto
        console.log('Archivos detectados en drop: ', files.length);
      }
    }, false);
  `);
  
  // Parchar los botones de copia para usar nuestro helper
  const patchCopyButtons = () => {
    const copyButtons = document.querySelectorAll('[aria-label="Copy code"], .copy-button, .code-block-copy-button, [data-testid="copy-code-button"], button[class*="copy"], div[class*="copyButton"]');
    copyButtons.forEach(button => {
      if (!button.hasAttribute('clipboard-patched')) {
        button.setAttribute('clipboard-patched', 'true');
        
        // Clonar y reemplazar para eliminar cualquier listener previo
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', (event) => {
          // Encontrar el texto de código
          const findCodeElement = (btn) => {
            const parent = btn.closest('.relative, [class*="codeBlock"], pre, [class*="code"]');
            return parent ? parent.querySelector('code, pre') : null;
          };
          
          const codeElement = findCodeElement(newButton);
          if (codeElement) {
            const text = codeElement.textContent;
            secureElectronAPI.copyToClipboard(text);
            
            // Indicar visualmente éxito
            newButton.classList.add('copied');
            setTimeout(() => {
              newButton.classList.remove('copied');
            }, 1500);
          }
        });
      }
    });
  };
  
  // Observer para detectar cambios en el DOM que requieran parcheo
  const observer = new MutationObserver((mutations) => {
    let shouldPatchCopyButtons = false;
    
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        // Verificar si hay elementos de canvas, código o botones de copia
        const codeBlocks = document.querySelectorAll('pre, code, [class*="codeBlock"], button[class*="copy"]');
        if (codeBlocks.length > 0) {
          shouldPatchCopyButtons = true;
          break;
        }
      }
    }
    
    if (shouldPatchCopyButtons) {
      patchCopyButtons();
    }
  });
  
  // Observar cambios relevantes en el DOM
  observer.observe(document.body, { 
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-label', 'data-testid']
  });
  
  // Primera ejecución del parcheo
  setTimeout(patchCopyButtons, 1000);
  
  // Detectar acciones de copiado global para mejorar compatibilidad
  document.addEventListener('copy', (event) => {
    // Verificar si estamos en un canvas o bloque de código
    const isInCodeBlock = event.target.closest('pre, code') || 
                           event.target.closest('.relative') ||
                           event.target.closest('[class*="prose"]') ||
                           event.target.closest('[class*="codeBlock"]');
    
    if (isInCodeBlock && (!event.clipboardData || !event.clipboardData.getData('text'))) {
      // Si el evento normal de copia falló (sin datos en el portapapeles)
      const selection = window.getSelection();
      const text = selection.toString();
      
      if (text) {
        // Usar nuestra implementación de copia
        secureElectronAPI.copyToClipboard(text);
        // Prevenir comportamiento predeterminado para evitar doble copia
        event.preventDefault();
      }
    }
  });
  
  // Detectar teclas para mejorar experiencia en Claude
  document.addEventListener('keydown', (event) => {
    // Gestionar atajos de teclado comunes en navegadores
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      // Permitir búsqueda en página (manejada por main.js)
    }
    
    // Manejar Esc para cancelar búsqueda, etc.
    if (event.key === 'Escape') {
      // Permitir comportamiento nativo
    }
  });
  
  // Inyectar script para detectar cuando Claude está completamente cargado
  const clarisInterval = setInterval(() => {
    const textareas = document.querySelectorAll('textarea[placeholder], [contenteditable="true"]');
    const inputArea = document.querySelector('[class*="promptTextarea"], [class*="inputArea"]');
    
    if (textareas.length > 0 || inputArea) {
      clearInterval(clarisInterval);
      console.log('Claude UI detectada, ocultando pantalla de carga');
      
      // Ocultar la pantalla de carga
      const loadingElement = document.getElementById('loading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
    }
  }, 500);
  
  // Timeout de seguridad para asegurar que la pantalla de carga desaparece
  setTimeout(() => {
    const loadingElement = document.getElementById('loading');
    if (loadingElement && loadingElement.style.display !== 'none') {
      loadingElement.style.display = 'none';
    }
  }, 10000);
});