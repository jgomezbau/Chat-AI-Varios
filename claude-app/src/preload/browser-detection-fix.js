// Script para evitar la detección de Electron y simular un navegador Chrome normal

const browserDetectionFixScript = `
(function() {
  // Ocultar cualquier evidencia de Electron en el objeto window
  const electronProperties = [
    'electron',
    'process',
    'require',
    '_events',
    'Buffer',
    'module',
    'nodeRequire',
    'nodeProcess',
    'webContents'
  ];

  // Eliminar propiedades relacionadas con Electron
  for (const prop of electronProperties) {
    if (window[prop]) {
      try {
        delete window[prop];
      } catch (e) {
        console.debug('No se pudo eliminar propiedad:', prop);
      }
    }
  }

  // Parchar navigator para simular Chrome
  const patchNavigator = () => {
    // User Agent de Chrome actual
    const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    
    // Parchar navigator.userAgent si contiene "Electron"
    if (navigator.userAgent.includes('Electron')) {
      try {
        Object.defineProperty(navigator, 'userAgent', {
          get: function() {
            return chromeUserAgent;
          }
        });
      } catch (e) {
        console.debug('No se pudo parchar userAgent');
      }
    }

    // Parchar appVersion y vendor
    try {
      Object.defineProperty(navigator, 'appVersion', {
        get: function() {
          return '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
        }
      });
      
      Object.defineProperty(navigator, 'vendor', {
        get: function() {
          return 'Google Inc.';
        }
      });
    } catch (e) {
      console.debug('No se pudo parchar navigator.appVersion o vendor');
    }

    // Parchar plataforma
    try {
      Object.defineProperty(navigator, 'platform', {
        get: function() {
          return 'Win32';
        }
      });
    } catch (e) {
      console.debug('No se pudo parchar navigator.platform');
    }
  };

  // Parchar plugins para simular los de Chrome
  const patchPlugins = () => {
    if (navigator.plugins.length === 0) {
      // Crear plugin ficticio de Chrome PDF Viewer
      const fakePdfPlugin = {
        name: 'Chrome PDF Viewer',
        filename: 'internal-pdf-viewer',
        description: 'Portable Document Format',
        version: '',
        length: 1
      };

      // Intentar añadir al array de plugins
      try {
        Object.defineProperty(navigator, 'plugins', {
          get: function() {
            const plugins = [fakePdfPlugin];
            plugins.item = (i) => plugins[i];
            plugins.namedItem = (name) => plugins.find(p => p.name === name);
            Object.defineProperty(plugins, 'length', { value: 1 });
            return plugins;
          }
        });

        Object.defineProperty(navigator, 'mimeTypes', {
          get: function() {
            const mimeTypes = [{
              type: 'application/pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format'
            }];
            mimeTypes.item = (i) => mimeTypes[i];
            mimeTypes.namedItem = (name) => mimeTypes.find(m => m.type === name);
            Object.defineProperty(mimeTypes, 'length', { value: 1 });
            return mimeTypes;
          }
        });
      } catch (e) {
        console.debug('No se pudieron parchar plugins o mimeTypes:', e);
      }
    }
  };

  // Parchar propiedades y funciones de detección de automatización
  const patchAutomationProps = () => {
    const properties = {
      webdriver: false,
      domAutomation: false,
      domAutomationController: false
    };

    for (const [prop, value] of Object.entries(properties)) {
      try {
        Object.defineProperty(navigator, prop, {
          get: function() {
            return value;
          }
        });
      } catch (e) {
        console.debug('No se pudo parchar:', prop);
      }
    }
  };

  // Parchar objetos de pantalla para evitar métodos de fingerprinting
  const patchScreen = () => {
    // Valores típicos de un monitor promedio
    const screenProps = {
      availWidth: 1920,
      availHeight: 1080,
      width: 1920,
      height: 1080,
      colorDepth: 24,
      pixelDepth: 24
    };

    try {
      for (const [prop, value] of Object.entries(screenProps)) {
        Object.defineProperty(screen, prop, {
          get: function() {
            return value;
          }
        });
      }
    } catch (e) {
      console.debug('No se pudo parchar screen:', e);
    }
  };

  // Parchar Chrome-specific APIs
  const patchChromeAPIs = () => {
    if (!window.chrome) {
      const mockChrome = {
        app: {
          isInstalled: false,
          InstallState: { INSTALLED: 'INSTALLED', NOT_INSTALLED: 'NOT_INSTALLED' },
          RunningState: { CANNOT_RUN: 'CANNOT_RUN', READY_TO_RUN: 'READY_TO_RUN', RUNNING: 'RUNNING' }
        },
        runtime: {
          connect: function() {
            return {
              onDisconnect: {
                addListener: function() {}
              },
              onMessage: {
                addListener: function() {}
              },
              postMessage: function() {}
            };
          },
          sendMessage: function() {
            return Promise.resolve();
          },
          onMessage: {
            addListener: function() {},
            removeListener: function() {}
          }
        },
        webstore: {
          onInstallStageChanged: {
            addListener: function() {}
          },
          onDownloadProgress: {
            addListener: function() {}
          }
        }
      };

      try {
        window.chrome = mockChrome;
      } catch (e) {
        console.debug('No se pudo parchar window.chrome:', e);
      }
    }
  };

  // Parchar console.debug para minimizar logs de debuggeo
  const originalDebug = console.debug;
  console.debug = function() {
    // No hacer nada, o descomentar para mantener logs:
    // originalDebug.apply(console, arguments);
  };

  // Ejecutar todos los parches
  patchNavigator();
  patchPlugins();
  patchAutomationProps();
  patchScreen();
  patchChromeAPIs();

  // Patch para bloquear métodos de detección
  window.navigator.mediaDevices = window.navigator.mediaDevices || {};
  window.navigator.mediaDevices.enumerateDevices = window.navigator.mediaDevices.enumerateDevices || function() {
    return Promise.resolve([
      {
        deviceId: 'default',
        kind: 'audioinput',
        label: 'Default - Internal Microphone',
        groupId: 'default'
      },
      {
        deviceId: 'default',
        kind: 'audiooutput',
        label: 'Default - Internal Speakers',
        groupId: 'default'
      },
      {
        deviceId: 'default',
        kind: 'videoinput',
        label: 'Default - USB Webcam',
        groupId: 'default'
      }
    ]);
  };

  // Ocultar características que puedan delatar Electron
  const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(parameter) {
    // Interceptar llamadas que pueden usarse para detección de navegador
    if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
      return 'Google Inc.';
    }
    if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
      return 'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)';
    }
    return originalGetParameter.apply(this, arguments);
  };

  // Reportar que somos un Chrome normal
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark-theme');
  }
})();
`;

module.exports = { browserDetectionFixScript };