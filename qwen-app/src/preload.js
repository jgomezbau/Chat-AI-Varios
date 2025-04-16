const { contextBridge, ipcRenderer } = require('electron');

// Eliminar completamente cualquier función de audio antes de que se cargue la página
function disableAllAudio() {
  try {
    // Bloquear AudioContext
    Object.defineProperty(window, 'AudioContext', {
      get: function() {
        console.log('[BLOQUEADO] Intento de acceder a AudioContext');
        return function() {
          return {
            // Dummy functions that do nothing
            createMediaStreamSource: () => ({}),
            createGain: () => ({ gain: { value: 0 } }),
            createAnalyser: () => ({}),
            createOscillator: () => ({}),
            createScriptProcessor: () => ({}),
            suspend: () => Promise.resolve(),
            resume: () => Promise.resolve(),
            close: () => Promise.resolve(),
            state: 'closed',
            destination: { maxChannelCount: 2 }
          };
        };
      },
      configurable: false
    });

    // Bloquear webkitAudioContext
    Object.defineProperty(window, 'webkitAudioContext', {
      get: function() {
        console.log('[BLOQUEADO] Intento de acceder a webkitAudioContext');
        return window.AudioContext;
      },
      configurable: false
    });

    // Bloquear SpeechSynthesis
    Object.defineProperty(window, 'speechSynthesis', {
      get: function() {
        console.log('[BLOQUEADO] Intento de acceder a speechSynthesis');
        return {
          speak: () => {},
          cancel: () => {},
          pause: () => {},
          resume: () => {},
          getVoices: () => [],
          pending: false,
          speaking: false,
          paused: false,
          onvoiceschanged: null
        };
      },
      configurable: false
    });

    // Capturar intentos de usar el API Web Audio y convertirlos en operaciones sin efecto
    ['MediaStreamAudioSourceNode', 'AnalyserNode', 'GainNode', 'StereoPannerNode', 
     'ScriptProcessorNode', 'AudioBuffer', 'AudioDestinationNode'].forEach(audioClass => {
      try {
        Object.defineProperty(window, audioClass, {
          get: function() {
            console.log(`[BLOQUEADO] Intento de acceder a ${audioClass}`);
            return function() { return {}; };
          },
          configurable: false
        });
      } catch (e) {
        // Ignorar si no se puede redefinir
      }
    });

    console.log('APIs de audio desactivadas correctamente');
  } catch (e) {
    console.error('Error al deshabilitar audio:', e);
  }
}

// Función para bloquear sensores que no necesitamos
function blockSensors() {
  try {
    // Bloquear acceso a sensores de movimiento
    Object.defineProperty(window, 'DeviceMotionEvent', {
      get: function() {
        console.log('[BLOQUEADO] Intento de acceder a DeviceMotionEvent');
        return undefined;
      },
      configurable: false
    });

    Object.defineProperty(window, 'DeviceOrientationEvent', {
      get: function() {
        console.log('[BLOQUEADO] Intento de acceder a DeviceOrientationEvent');
        return undefined;
      },
      configurable: false
    });

    console.log('APIs de sensores bloqueadas correctamente');
  } catch (e) {
    console.error('Error al bloquear sensores:', e);
  }
}

// Exponer API segura al contexto web
contextBridge.exposeInMainWorld('qwenApp', {
  // Información del sistema
  platform: process.platform,
  electronVersion: process.versions.electron,
  
  // Funciones para manejar la app
  reload: () => ipcRenderer.send('reload-app'),
  reportError: (message) => ipcRenderer.send('report-error', message),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Verificar si estamos en Electron
  isElectron: true
});

// Ejecutar inmediatamente antes de que se cargue cualquier script
disableAllAudio();
blockSensors();

// Configurar manejo de errores globales
window.addEventListener('error', (event) => {
  // Filtrar errores de terceros que no son críticos
  if (event.message && (
    event.message.includes('fireyejs') || 
    event.message.includes('et_f.js') ||
    event.message.includes('Permissions policy') ||
    event.message.includes('deviceorientation')
  )) {
    console.warn('[ERROR NO CRÍTICO]', event.message);
  } else {
    console.error('[ERROR CAPTURADO]', event.message);
  }
  
  // Prevenir que el error cierre la app
  event.preventDefault();
  return true;
}, true);

window.addEventListener('unhandledrejection', (event) => {
  console.error('[PROMESA RECHAZADA]', event.reason);
  // Prevenir que el error cierre la app
  event.preventDefault();
  return true;
}, true);

// Interceptar console.error para evitar que ciertos errores ensucien la consola
const originalConsoleError = console.error;
console.error = function(...args) {
  // Filtrar errores conocidos no críticos
  const errorMessage = args.join(' ');
  if (
    errorMessage.includes('fireyejs') || 
    errorMessage.includes('et_f.js') ||
    errorMessage.includes('Permissions policy') ||
    errorMessage.includes('CSP')
  ) {
    console.warn('[ERROR FILTRADO]', ...args);
  } else {
    originalConsoleError.apply(console, args);
  }
};

// Notificar que el preload está listo
console.log('Script de precarga ejecutado correctamente');
