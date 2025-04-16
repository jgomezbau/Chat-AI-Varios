const { contextBridge, ipcRenderer, clipboard } = require('electron');
const { clipboardFixScript } = require('./clipboard-fix');
const { clipboardStyles, injectStyles } = require('./inject-styles');

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

// Función para mostrar notificaciones
function showNotification(message, isError = false) {
  // Solo mostrar si estamos en producción o si es un error
  if (process.env.NODE_ENV !== 'development' || isError) {
    // Crear notificación temporal en el DOM
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Eliminar la notificación después de 3 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// Exponer funciones seguras al contexto de la página web
contextBridge.exposeInMainWorld('electronAPI', {
  // Funciones de portapapeles
  copyToClipboard: (text) => handleClipboardCopy(text),
  readFromClipboard: () => handleClipboardRead(),
  
  // Funciones del sistema
  getSystemInfo: () => {
    return {
      platform: process.platform,
      version: process.versions.electron
    };
  },
  
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
});

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

// Inyectar arreglo de portapapeles cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM cargado, inyectando scripts y estilos');
  
  // Inyectar nuestros estilos CSS
  const styleElement = document.createElement('style');
  styleElement.textContent = clipboardStyles;
  document.head.appendChild(styleElement);
  
  // Inyectar nuestro script de arreglo de portapapeles
  injectScript(clipboardFixScript);
  
  // Observer para detectar cambios adicionales en DOM
  // que podrían requerir re-inyección del arreglo
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        // Verificar si hay elementos de canvas o código
        const codeBlocks = document.querySelectorAll('pre, code');
        if (codeBlocks.length > 0) {
          // Re-inyectar el script si es necesario
          injectScript(clipboardFixScript);
        }
      }
    }
  });
  
  // Observar solo cambios relevantes
  observer.observe(document.body, { 
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
  
  // Inyectar manejadores adicionales para problemas específicos
  document.addEventListener('copy', (event) => {
    // Verificar si estamos en un canvas o bloque de código
    const isInCodeBlock = event.target.closest('pre, code') || 
                           event.target.closest('.relative') ||
                           event.target.closest('[class*="prose"]');
    
    if (isInCodeBlock && !event.clipboardData.getData('text')) {
      // Si el evento normal de copia falló (sin datos en el portapapeles)
      const selection = window.getSelection();
      const text = selection.toString();
      
      if (text) {
        // Usar nuestra implementación de copia
        handleClipboardCopy(text);
        // Prevenir comportamiento predeterminado para evitar doble copia
        event.preventDefault();
      }
    }
  });
});