const { app, BrowserWindow, Menu, session, shell, dialog, clipboard, net, Tray, nativeImage } = require('electron'); // Import Tray and nativeImage
const path = require('path');
const { setupIPC } = require('./src/preload/ipc');
const Store = require('electron-store');

// Configurar almacenamiento persistente
const store = new Store();

// NO desactivar aceleración por hardware para mejor rendimiento
// app.disableHardwareAcceleration();

// Variable para mantener la referencia a la ventana principal
let mainWindow;
// Variable para mantener la referencia al icono de la bandeja del sistema
let tray = null;

// Dominios permitidos para navegación directa - ampliar para cubrir todos los subdominios de Claude
const allowedDomains = [
  'claude.ai',
  'a-cdn.anthropic.com', 
  'anthropic.com',
  'claude.com',
  'www.gstatic.com',
  'statsig.anthropic.com',
  'www.claudeusercontent.com',
  'claudeusercontent.com',
  'www.claudemcpclient.com',
  'claudemcpclient.com',
  'app.intercom.com',
  'intercom.com',
  'intercomcdn.com',
  'csp.withgoogle.com',
  'apis.google.com',
  'accounts.google.com',
  'login.live.com',
  'appleid.apple.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'static.cloudflareinsights.com'
];

// Expresiones regulares para dominios permitidos - ampliados para más flexibilidad
const allowedLoginDomains = [
  /^.*claude\.ai$/,
  /^.*anthropic\.com$/,
  /^.*google\.com$/,
  /^.*gstatic\.com$/,
  /^.*googleapis\.com$/,
  /^.*claude\.com$/,
  /^.*microsoft\.com$/,
  /^.*live\.com$/,
  /^.*apple\.com$/,
  /^.*icloud\.com$/,
  /^.*claudeusercontent\.com$/,
  /^.*claudemcpclient\.com$/,
  /^.*intercom\.com$/,
  /^.*intercomcdn\.com$/,
  /^.*cdn\.jsdelivr\.net$/,
  /^.*cloudflareinsights\.com$/
];

// User Agents para navegadores populares - seleccionaremos Chrome por defecto
const browserUserAgents = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
};

// Estado global para seguimiento de autenticación
let isAuthenticating = false;
let authTargetUrl = null;

// --- SINGLE INSTANCE LOCK ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Si ya hay una instancia, salir inmediatamente
  app.quit();
} else {
  // Si es la instancia principal, manejar evento de segunda instancia
  app.on('second-instance', (event, argv, workingDirectory) => {
    // Restaurar y enfocar la ventana principal si existe
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    // Asegurar que el tray esté activo
    if (!tray && app.isReady()) {
      // recrear el tray si por alguna razón no existe
      const iconPath = require('path').join(__dirname, 'icons', 'icon.png');
      const { Tray, Menu } = require('electron');
      const icon = require('electron').nativeImage.createFromPath(iconPath);
      tray = new Tray(icon);
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Mostrar/Ocultar Claude',
          click: () => {
            if (mainWindow) {
              mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Salir',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]);
      tray.setToolTip('Claude');
      tray.setContextMenu(contextMenu);
      tray.on('click', () => {
        if (mainWindow) {
          mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        }
      });
    }
  });

  // Crear ventana principal
  function createWindow() {
    // Cargar config guardada o usar valores predeterminados
    const windowConfig = store.get('windowConfig') || {
      width: 1200,
      height: 800,
      x: undefined,
      y: undefined,
      maximized: false
    };

    // Crear la ventana con la configuración guardada
    mainWindow = new BrowserWindow({
      width: windowConfig.width,
      height: windowConfig.height,
      x: windowConfig.x,
      y: windowConfig.y,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'src', 'preload', 'preload.js'),
        devTools: true,
        spellcheck: true,
        // Configuraciones para simulación de navegador completo
        enableWebSQL: true,
        enableRemoteModule: false,
        sandbox: false,
        webSecurity: true,
        // Habilitar persistencia
        partition: 'persist:claudeApp',
        // Configuraciones de seguridad adicionales para autenticación
        allowRunningInsecureContent: false,
        webviewTag: false
      },
      icon: path.join(__dirname, 'icons', 'icon.png'),
      title: 'Claude',
      // Habilitar transparencia para mejor renderizado
      backgroundColor: '#ffffff'
    });

    // Restaurar el estado maximizado si estaba así anteriormente
    if (windowConfig.maximized) {
      mainWindow.maximize();
    }

    // Guardar la configuración de la ventana cuando se cierra o se oculta
    mainWindow.on('close', (event) => {
      // Si no estamos saliendo explícitamente, prevenir el cierre y ocultar
      if (!app.isQuitting) {
        event.preventDefault();
        mainWindow.hide();
      }

      // Guardar estado incluso al ocultar (puede ser útil)
      const { width, height } = mainWindow.getBounds();
      const isMaximized = mainWindow.isMaximized();
      const bounds = isMaximized ? { width, height } : mainWindow.getBounds();

      store.set('windowConfig', {
        width: bounds.width,
        height: bounds.height,
        x: isMaximized ? undefined : bounds.x,
        y: isMaximized ? undefined : bounds.y,
        maximized: isMaximized
      });

      // Si estamos saliendo, permitir que la ventana se cierre
      // (necesario para que 'closed' se emita y mainWindow se ponga a null)
      if (app.isQuitting) {
        mainWindow = null; // Asegurarse de que la referencia se limpia al salir
      }
    });

    // Modificar el User Agent para simular Chrome
    const userAgent = browserUserAgents.chrome;
    
    // Manejar el intercambio de código de autorización y OAuth
    let oauthCode = null;
    let oauthState = null;
    
    // Configurar interceptor para capturar el código de autenticación OAuth
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      try {
        const url = details.url;
        
        // Detectar URLs de redirección de OAuth
        if ((url.includes('storagerelay') || url.includes('code=')) && isAuthenticating) {
          const urlObj = new URL(url);
          
          // Extraer código de autenticación
          if (urlObj.searchParams.has('code')) {
            oauthCode = urlObj.searchParams.get('code');
          }
          
          // Extraer estado
          if (urlObj.searchParams.has('state')) {
            oauthState = urlObj.searchParams.get('state');
          }
          
          // Marcar para redirección a Claude tras completar el proceso
          authTargetUrl = 'https://claude.ai/';
          
          // No interferir con la petición
          callback({});
        } else {
          // Permitir todas las demás solicitudes
          callback({});
        }
      } catch (e) {
        callback({});
      }
    });
    
    // Configurar interceptor para simular navegador real modificando User-Agent y encabezados HTTP
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const { requestHeaders } = details;
      const url = details.url;
      
      // Reemplazar User-Agent con el del navegador elegido
      requestHeaders['User-Agent'] = userAgent;
      
      // Agregar encabezados específicos para emular Chrome
      requestHeaders['Sec-Ch-Ua'] = '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"';
      requestHeaders['Sec-Ch-Ua-Mobile'] = '?0';
      requestHeaders['Sec-Ch-Ua-Platform'] = '"Windows"';
      
      // Encabezados para solicitudes normales
      if (!details.url.includes('oauth') && !isAuthenticating) {
        requestHeaders['Sec-Fetch-Dest'] = 'document';
        requestHeaders['Sec-Fetch-Mode'] = 'navigate';
        requestHeaders['Sec-Fetch-Site'] = 'none';
        requestHeaders['Sec-Fetch-User'] = '?1';
        requestHeaders['Upgrade-Insecure-Requests'] = '1';
      } 
      // Configuración especial para OAuth
      else if (isAuthenticating) {
        // Para solicitudes OAuth, usar valores más apropiados
        requestHeaders['Sec-Fetch-Dest'] = 'document';
        requestHeaders['Sec-Fetch-Mode'] = 'navigate';
        requestHeaders['Sec-Fetch-Site'] = 'cross-site';
        
        // Agregar Referer para OAuth
        if (url.includes('accounts.google.com')) {
          requestHeaders['Referer'] = 'https://claude.ai/';
          
          // Añadir Origin para peticiones POST de autenticación
          if (details.method === 'POST') {
            requestHeaders['Origin'] = 'https://accounts.google.com';
          }
        }
        
        // Enviar el código de autorización capturado si lo tenemos
        if (oauthCode && url.includes('claude.ai')) {
          // No modificar la URL directamente aquí, lo manejamos al regresar a Claude
        }
      }
      
      // Eliminar cualquier encabezado que delate Electron
      delete requestHeaders['X-Electron'];
      
      callback({ requestHeaders });
    });

    // Mejorar manejo de autenticación - detectar y registrar navegación
    mainWindow.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
      if (isMainFrame) {
        try {
          const hostname = new URL(url).hostname;
          
          // Detectar si estamos en proceso de autenticación
          if (hostname.includes('accounts.google.com') || 
              hostname.includes('login.microsoftonline.com') ||
              hostname.includes('appleid.apple.com')) {
            isAuthenticating = true;
          }
          
          // Detectar posible redirección de vuelta a Claude
          if (hostname.includes('claude.ai') && isAuthenticating) {
            authTargetUrl = 'https://claude.ai/';
            // No hacer nada aquí, dejar que la navegación continúe
          }
        } catch (error) {
          // Silenciar errores
        }
      }
    });
    
    // Referencia al popup de autenticación
    let authWindow = null;
    
    // Configurar el manejador de apertura de ventanas para permitir popups reales para autenticación
    mainWindow.webContents.setWindowOpenHandler(({ url, frameName, features }) => {
      try {
        const hostname = new URL(url).hostname;
        
        // Verificar si es un dominio permitido para navegación interna
        const isAllowedDomain = allowedLoginDomains.some(domain => 
          domain instanceof RegExp ? domain.test(hostname) : hostname.includes(domain)
        );
        
        // Comprobar si es parte del flujo de autenticación
        const isAuthDomain = hostname.includes('accounts.google.com') || 
                          hostname.includes('login.microsoftonline.com') ||
                          hostname.includes('appleid.apple.com');
        
        // Determinar si parece una ventana de autenticación
        const isAuthWindow = isAuthDomain || 
                            url.includes('oauth') || 
                            url.includes('signin') || 
                            url.includes('login') ||
                            url.includes('auth') ||
                            frameName === 'auth' ||
                            frameName === 'signin' ||
                            frameName.includes('popup');
        
        // Para ventanas de autenticación, permitir ventanas emergentes reales
        if (isAuthWindow) {
          // Marcar que estamos en proceso de autenticación
          isAuthenticating = true;
          
          // Extraer configuraciones de la ventana emergente si están disponibles
          let width = 600;
          let height = 800;
          
          // Si hay características específicas, intentar usarlas (como haría un navegador real)
          if (features) {
            const featureParts = features.split(',');
            for (const part of featureParts) {
              const [key, value] = part.trim().split('=');
              if (key === 'width' && !isNaN(Number(value))) {
                width = Number(value);
              } else if (key === 'height' && !isNaN(Number(value))) {
                height = Number(value);
              }
            }
          }
          
          // Asegurarse de que la ventana tenga un tamaño mínimo razonable
          width = Math.max(width, 400);
          height = Math.max(height, 600);
          
          // Permitir que se abra la ventana emergente, exactamente como lo haría un navegador
          return { 
            action: 'allow',
            overrideBrowserWindowOptions: {
              width: width,
              height: height,
              title: frameName || 'Autenticación',
              show: true, // Asegurarse de que la ventana sea visible
              autoHideMenuBar: true,
              webPreferences: {
                partition: 'persist:claudeApp', // Misma partición para compartir cookies
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true,
                spellcheck: false, // No necesario para ventanas de auth
                // Importante para popups de autenticación
                allowRunningInsecureContent: false,
                webviewTag: false,
                javascript: true,
                images: true // Asegurar que se carguen imágenes (importante para captchas)
              }
            }
          };
        } 
        // Para contenido permitido normal pero no de autenticación, cargar en la misma ventana
        else if (isAllowedDomain) {
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(url);
            }
          }, 50);
          
          return { action: 'deny' };
        } 
        // Para enlaces externos, abrir en el navegador predeterminado
        else {
          shell.openExternal(url);
          return { action: 'deny' };
        }
      } catch (error) {
        return { action: 'deny' };
      }
    });
    
    // Manejar la creación de ventanas emergentes
    app.on('browser-window-created', (event, window) => {
      // Verificar si es una ventana de autenticación (diferente de la principal)
      if (window !== mainWindow) {
        // Guardar referencia a la ventana de autenticación
        authWindow = window;
        
        // Configurar el mismo User-Agent y otros parámetros para la ventana emergente
        window.webContents.userAgent = userAgent;
        
        // Inyectar nuestro script auxiliar para la ventana emergente
        window.webContents.on('did-finish-load', () => {
          // Cargar e inyectar el script auxiliar para la ventana emergente
          try {
            const { popupAuthHelper } = require('./src/preload/popup-auth-helper');
            window.webContents.executeJavaScript(popupAuthHelper)
              .catch(() => {});
          } catch (error) {
            // Silenciar errores
          }
        });
        
        // Manejar cierre de la ventana de autenticación
        window.on('closed', () => {
          authWindow = null;
          
          // Notificar a la ventana principal que la autenticación ha terminado
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              // Marcar que se completó el proceso en la ventana principal
              mainWindow.webContents.executeJavaScript(`
                // Marcar que se completó la autenticación para proceso posterior
                window.sessionStorage.setItem('oauth_completed', 'true');
                window.localStorage.setItem('oauth_completed_timestamp', Date.now().toString());
                
                // Si estamos en Claude, recargar para aplicar la autenticación
                if (window.location.hostname.includes('claude.ai')) {
                  // Recargar con timestamp para evitar caché
                  setTimeout(() => {
                    // Intentar primero una actualización suave
                    try {
                      // Forzar refresco de cookies y almacenamiento
                      document.cookie.split(';').forEach(cookie => {
                        const [name] = cookie.trim().split('=');
                        if (name && (name.includes('auth') || name.includes('session'))) {
                          const updatedCookie = cookie.trim() + '; expires=' + new Date(Date.now() + 86400000).toUTCString();
                          document.cookie = updatedCookie;
                        }
                      });
                      
                      // Verificar si hay algún elemento que indique sesión activa
                      const userMenu = document.querySelector('[aria-label="User Menu"], [class*="userMenu"], [class*="avatar"]');
                      
                      if (!userMenu) {
                        // Si no hay indicador de sesión, hacer refresh completo
                        window.location.href = 'https://claude.ai/?' + new Date().getTime();
                      } else {
                        // Si ya tenemos sesión, hacer un refresh más suave
                        // Triggerear un evento personalizado para notificar actualización de auth
                        window.dispatchEvent(new CustomEvent('auth_session_updated'));
                      }
                    } catch (e) {
                      // Fallback a recarga completa
                      window.location.href = 'https://claude.ai/?' + new Date().getTime();
                    }
                  }, 800);
                }
              `).catch(() => {});
              
              // Limpiar estado de autenticación con más seguridad
              setTimeout(() => {
                isAuthenticating = false;
                
                // Verificar estado actual
                if (mainWindow && !mainWindow.isDestroyed()) {
                  const currentUrl = mainWindow.webContents.getURL();
                  if (!currentUrl.includes('claude.ai')) {
                    mainWindow.loadURL('https://claude.ai/?' + Date.now());
                  }
                }
              }, 2000);
            }
          }, 1000);
        });
        
        // Manejar mensajes desde el script de helper en la ventana emergente
        window.webContents.ipc.on('auth-message', (event, message) => {
          // Manejar diferentes tipos de mensajes con estructura mejorada
          if (typeof message === 'object') {
            switch (message.type) {
              case 'auth_complete':
                // Después de un breve retraso, navegar a Claude
                setTimeout(() => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    authTargetUrl = 'https://claude.ai/';
                    mainWindow.loadURL('https://claude.ai/?t=' + Date.now());
                  }
                }, 1000);
                
                // Cerrar ventana emergente
                if (window && !window.isDestroyed()) {
                  setTimeout(() => window.close(), 500);
                }
                break;
                
              case 'auth_code_received':
                if (message.code) {
                  // Guardar código para uso posterior
                  oauthCode = message.code;
                  
                  // Después de un breve retraso, navegar a Claude
                  setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                      authTargetUrl = 'https://claude.ai/';
                      mainWindow.loadURL('https://claude.ai/?t=' + Date.now());
                    }
                  }, 1000);
                }
                
                // Cerrar ventana emergente
                if (window && !window.isDestroyed()) {
                  setTimeout(() => window.close(), 500);
                }
                break;
                
              case 'auth_step_change':
                // No cerrar la ventana, estamos en un flujo de múltiples pasos
                break;
                
              case 'auth_input_needed':
                // No cerrar la ventana, el usuario necesita ingresar información
                break;
                
              case 'auth_error':
                // No cerrar la ventana, dejar que el usuario vea el error
                break;
                
              case 'auth_timeout':
                // Cerrar ventana emergente y resetear estado de autenticación
                if (window && !window.isDestroyed()) {
                  window.close();
                }
                isAuthenticating = false;
                break;
                
              case 'popup_status':
                // Si estamos en un paso de verificación, dar más tiempo
                break;
                
              case 'auth_state_reset':
                // Estado de autenticación reiniciado
                break;
            }
          } 
          // Mantener compatibilidad con formato antiguo
          else if (typeof message === 'string') {
            if (message === 'auth_complete' || message.startsWith('auth_code_received:')) {
              // Si recibimos código de autenticación, extraerlo
              if (message.startsWith('auth_code_received:')) {
                oauthCode = message.split(':')[1];
              }
              
              // Navegar a Claude después de un breve retraso
              setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.loadURL('https://claude.ai/?t=' + Date.now());
                }
              }, 1000);
              
              // Cerrar ventana emergente
              setTimeout(() => {
                if (window && !window.isDestroyed()) {
                  window.close();
                }
              }, 500);
            }
          }
        });
      }
    });

    // Configurar navegación
    mainWindow.webContents.on('will-navigate', (event, url) => {
      try {
        const hostname = new URL(url).hostname;
        
        // Determinar si es un dominio permitido
        const isAllowedDomain = allowedLoginDomains.some(domain => 
          domain instanceof RegExp ? domain.test(hostname) : hostname.includes(domain)
        );
        
        // Determinar si es parte del flujo de autenticación
        const isAuthDomain = hostname.includes('accounts.google.com') || 
                          hostname.includes('login.microsoftonline.com') ||
                          hostname.includes('appleid.apple.com');
        
        // Lógica mejorada: permitir siempre navegación durante autenticación
        if (isAllowedDomain || isAuthDomain || isAuthenticating) {
          // Permitir la navegación
          
          // Si estamos volviendo a Claude después de autenticación
          if (hostname.includes('claude.ai') && isAuthenticating) {
            isAuthenticating = false; // Resetear el estado de autenticación
          }
        } else {
          // Sólo bloquear navegación a dominios no permitidos
          event.preventDefault();
          shell.openExternal(url);
        }
      } catch (error) {
        // En caso de error, permitir la navegación por defecto
      }
    });
    
    // Manejar redirecciones específicamente (importante para OAuth)
    mainWindow.webContents.on('did-redirect-navigation', (event, url, isInPlace, isMainFrame) => {
      if (isMainFrame) {
        try {
          const hostname = new URL(url).hostname;
          
          // Si estamos en proceso de autenticación, manejar redirecciones de forma especial
          if (isAuthenticating) {
            // Detectar redirecciones específicas de OAuth
            if (url.includes('storagerelay') || url.includes('oauth2') || url.includes('accounts.google.com/o/oauth2')) {
              // Extraer código si está presente en la URL
              try {
                const urlObj = new URL(url);
                if (urlObj.searchParams.has('code')) {
                  oauthCode = urlObj.searchParams.get('code');
                }
              } catch (e) {
                // Silenciar error
              }
              
              // No interferir con la redirección OAuth
              // Dejar que el flujo natural continúe, evitar interferencias adicionales
              return;
            }
            
            // Específicamente para páginas que podrían cerrar la ventana
            if (url.includes('blank') || url.includes('close') || url.includes('callback')) {
              // Si estamos en la ventana principal, redirigir a Claude
              // En popups, esta lógica ya está manejada por popup-auth-helper.js
              if (!authWindow || authWindow.isDestroyed()) {
                setTimeout(() => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.loadURL('https://claude.ai/?' + Date.now());
                  }
                  isAuthenticating = false;
                }, 1000);
              }
            }
            
            // Si volvemos a Claude, procesamiento especial
            if (hostname.includes('claude.ai')) {
              // Esperar un poco para asegurar que se completa el proceso
              setTimeout(() => {
                // Verificar si tenemos código OAuth
                if (oauthCode) {
                  // El código ya está disponible
                }
                
                // Asegurarnos de que la URL incluya cualquier código necesario
                const currentUrl = mainWindow.webContents.getURL();
                if (!currentUrl.includes('?') || !currentUrl.includes('claude.ai')) {
                  mainWindow.loadURL('https://claude.ai/?' + Date.now());
                }
                
                // Finalizar estado de autenticación
                isAuthenticating = false;
                
                // Ejecutar script para verificar estado de sesión después de autenticación
                setTimeout(() => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.executeJavaScript(`
                      // Verificar si tenemos una sesión activa
                      const checkSession = () => {
                        const userMenu = document.querySelector('[aria-label="User Menu"], [class*="userMenu"], [class*="avatar"]');
                        return !!userMenu;
                      };
                      
                      // Si no detectamos sesión después de 3 segundos, recargar
                      setTimeout(() => {
                        if (!checkSession()) {
                          window.location.reload();
                        }
                      }, 3000);
                    `).catch(() => {});
                  }
                }, 2000);
              }, 1000);
            }
          }
        } catch (error) {
          // Silenciar errores
        }
      }
    });
    
    // Manejar eventos de OAuth específicamente
    mainWindow.webContents.on('will-prevent-unload', (event) => {
      if (isAuthenticating) {
        event.preventDefault();
      }
    });
    
    // Ya no prevenimos nuevas ventanas, las manejamos en setWindowOpenHandler
    mainWindow.webContents.on('new-window', (event, url) => {
      // No hacer nada aquí, ya lo manejamos en setWindowOpenHandler
    });

    // Configurar interceptor para solucionar problemas CORS
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const { responseHeaders } = details;
      
      // Permitir CORS para dominios relacionados con Claude
      if (responseHeaders) {
        delete responseHeaders['X-Frame-Options'];
        delete responseHeaders['Content-Security-Policy'];
        
        // Agregar encabezados que permiten compartir recursos
        if (details.resourceType === 'xhr' || details.resourceType === 'fetch') {
          responseHeaders['Access-Control-Allow-Origin'] = ['*'];
          responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, PUT, DELETE'];
          responseHeaders['Access-Control-Allow-Headers'] = ['Content-Type, Authorization, X-Requested-With'];
        }
      }
      
      callback({ responseHeaders });
    });

    // Cargar URL de Claude
    mainWindow.loadURL('https://claude.ai/new');
    
    // Abrir DevTools solo en modo desarrollo
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
    
    // Mantener menú pero invisible en la ventana
    mainWindow.setMenuBarVisibility(false);
    mainWindow.autoHideMenuBar = true;

    // Configurar permisos - ampliar para incluir todos los permisos necesarios
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = [
        'media', 
        'geolocation', 
        'notifications', 
        'clipboard-read', 
        'clipboard-sanitized-write',
        'clipboard-write',
        'midi',
        'midiSysex',
        'pointerLock',
        'fullscreen'
      ];
      callback(allowedPermissions.includes(permission));
    });

    // Configurar cookies y almacenamiento persistente con mejor soporte para autenticación
    session.defaultSession.cookies.on('changed', (event, cookie, cause, removed) => {
      // Mantener cookies persistentes incluso después de cerrar la app
      if (!removed && cookie.session) {
        const { name, value, domain, path, secure, httpOnly, expirationDate } = cookie;
        
        // Determinar expiración adecuada basada en el contexto de la cookie
        let newExpirationDate = expirationDate;
        
        if (!newExpirationDate) {
          // Cookies de autenticación: duración más larga
          if (
            domain.includes('google.com') || 
            domain.includes('anthropic.com') || 
            domain.includes('claude.ai') ||
            name.toLowerCase().includes('auth') || 
            name.toLowerCase().includes('session') || 
            name.toLowerCase().includes('token') ||
            name.toLowerCase().includes('id')
          ) {
            // Cookies de autenticación: duración más larga (6 meses)
            newExpirationDate = Math.floor(Date.now() / 1000) + 15768000;
          } else {
            // Cookies regulares: 1 año
            newExpirationDate = Math.floor(Date.now() / 1000) + 31536000;
          }
        }
        
        // Convertir cookies de sesión a cookies persistentes
        const persistentCookie = {
          url: `http${secure ? 's' : ''}://${domain}${path}`,
          name,
          value,
          domain,
          path,
          secure,
          httpOnly,
          expirationDate: newExpirationDate
        };
        
        // Especial atención a cookies de autenticación
        const isAuthCookie = isAuthenticating || 
                            domain.includes('accounts.google.com') || 
                            domain.includes('login.live.com') ||
                            domain.includes('appleid.apple.com');
        
        // Usar técnica diferente para evitar problemas de reemplazo durante auth
        if (isAuthCookie) {
          // Para cookies de auth, primero verificar si ya existe
          session.defaultSession.cookies.get({
            name,
            domain
          }).then(cookies => {
            // Si no existe o tiene contenido diferente, actualizar
            const shouldUpdate = cookies.length === 0 || 
                                cookies[0].value !== value ||
                                (cookies[0].session && !cookies[0].expirationDate);
            
            if (shouldUpdate) {
              // Si existe, primero eliminar para evitar conflictos
              if (cookies.length > 0) {
                session.defaultSession.cookies.remove(persistentCookie.url, name)
                  .then(() => session.defaultSession.cookies.set(persistentCookie))
                  .catch(() => {});
              } else {
                session.defaultSession.cookies.set(persistentCookie)
                  .catch(() => {});
              }
            }
          }).catch(() => {
            session.defaultSession.cookies.set(persistentCookie)
              .catch(() => {});
          });
        } else {
          // Para cookies normales, persistir directamente
          session.defaultSession.cookies.set(persistentCookie)
            .catch(() => {});
        }
      }
    });

    // Configurar intervalo para verificar y restaurar cookies de autenticación
    // Este mecanismo ayuda a evitar desconexiones inesperadas
    let cookieCheckInterval;
    
    // Función para verificar y restaurar cookies críticas
    const checkAuthCookies = () => {
      // Solo verificar si no estamos en proceso de autenticación
      if (!isAuthenticating) {
        // Verificar URL actual
        const currentUrl = mainWindow.webContents.getURL();
        
        // Solo verificar si estamos en Claude
        if (currentUrl.includes('claude.ai')) {
          // Ejecutar script para verificar sesión
          mainWindow.webContents.executeJavaScript(`
            // Verificar estado de sesión
            const isLoggedIn = !!document.querySelector('[class*="userMenu"], [aria-label="User Menu"], [class*="avatar"]');
            // Si no detectamos sesión activa pero deberíamos tenerla, recargar
            if (!isLoggedIn && localStorage.getItem('_claude_session_active') === 'true') {
              localStorage.removeItem('_claude_session_active');
              // Recargar con delay para evitar loops
              setTimeout(() => location.reload(), 1000);
              'session_reload';
            } else if (isLoggedIn) {
              // Marcar que tenemos sesión activa
              localStorage.setItem('_claude_session_active', 'true');
              'session_ok';
            } else {
              'no_session';
            }
          `).catch(() => {});
        }
      }
    };
    
    // Iniciar verificación periódica
    cookieCheckInterval = setInterval(checkAuthCookies, 90000); // cada 90 segundos
    
    // Limpiar intervalo cuando se cierra la ventana
    mainWindow.on('closed', () => {
      if (cookieCheckInterval) {
        clearInterval(cookieCheckInterval);
      }
    });

    // Interceptar errores de certificado - mejorado para desarrollo
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
      // Para desarrollo, aceptar certificados no válidos
      if (process.env.NODE_ENV === 'development') {
        event.preventDefault();
        callback(true);
      } else {
        // En producción, solo aceptar certificados válidos
        callback(false);
      }
    });

    // Menú contextual mejorado - igual al de un navegador real
    const contextMenuTemplate = [
      { label: 'Atrás', click: () => { if (mainWindow.webContents.canGoBack()) mainWindow.webContents.goBack(); } },
      { label: 'Adelante', click: () => { if (mainWindow.webContents.canGoForward()) mainWindow.webContents.goForward(); } },
      { label: 'Recargar', click: () => { mainWindow.reload(); } },
      { type: 'separator' },
      { label: 'Cortar', role: 'cut' },
      { label: 'Copiar', role: 'copy' },
      { label: 'Pegar', role: 'paste' },
      { label: 'Seleccionar todo', role: 'selectAll' },
      { type: 'separator' },
      { label: 'Guardar como...', click: () => { mainWindow.webContents.downloadURL(mainWindow.webContents.getURL()); } },
      { label: 'Imprimir', click: () => { mainWindow.webContents.print(); } },
      { 
        label: 'Inspeccionar', 
        click: (_, params) => { 
          mainWindow.webContents.inspectElement(params.x, params.y); 
        } 
      },
      { type: 'separator' },
      { label: 'Abrir en navegador', click: () => { shell.openExternal(mainWindow.webContents.getURL()); } }
    ];

    // Agregar listener para menú contextual mejorado
    mainWindow.webContents.on('context-menu', (event, params) => {
      // Habilitar/deshabilitar opciones según el contexto
      contextMenuTemplate[0].enabled = mainWindow.webContents.canGoBack();
      contextMenuTemplate[1].enabled = mainWindow.webContents.canGoForward();
      contextMenuTemplate[4].enabled = params.isEditable && params.editFlags.canCut;
      contextMenuTemplate[5].enabled = params.editFlags.canCopy;
      contextMenuTemplate[6].enabled = params.isEditable && params.editFlags.canPaste;
      contextMenuTemplate[7].enabled = params.editFlags.canSelectAll;
      
      // Crear y mostrar el menú contextual
      const menu = Menu.buildFromTemplate(contextMenuTemplate);
      menu.popup();
    });

    // Interceptar comandos de teclado para manejo mejorado
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Gestión mejorada de atajos de teclado
      if (input.control || input.meta) {
        if (input.key.toLowerCase() === 'c') {
          // La lógica de copiado mejorada está en preload.js
        }
        else if (input.key.toLowerCase() === 'v') {
          // La lógica de pegado está en preload.js
        }
        else if (input.key.toLowerCase() === 'f') {
          // Implementar búsqueda en página como un navegador real
          mainWindow.webContents.findInPage('');
        }
      }
    });

    // Finalizar búsqueda en página al presionar Escape
    mainWindow.webContents.on('found-in-page', (event, result) => {
      if (result.finalUpdate && result.matches === 0) {
        setTimeout(() => {
          mainWindow.webContents.stopFindInPage('clearSelection');
        }, 200);
      }
    });

    // Añadir manejadores de eventos para la carga y errores
    mainWindow.webContents.on('did-finish-load', () => {
      const currentUrl = mainWindow.webContents.getURL();

      // Si estamos volviendo de Google Auth a Claude
      if (currentUrl.startsWith('https://claude.ai') && isAuthenticating) {
        isAuthenticating = false;

        // Ejecutar código para asegurar que la sesión se mantenga
        mainWindow.webContents.executeJavaScript(`
          // Forzar refresco del localStorage para mantener sesión
          try {
            const currentTime = new Date().toISOString();
            localStorage.setItem('_claude_auth_timestamp', currentTime);
            localStorage.removeItem('_claude_auth_timestamp');
          } catch (e) {
            // Silenciar errores
          }
        `).catch(() => {});
      }
    });

    // Detectar fallos de carga (crítico para oauth)
    mainWindow.webContents.on('did-fail-load', (
      event, 
      errorCode, 
      errorDescription, 
      validatedURL, 
      isMainFrame
    ) => {
      // Ignorar algunos códigos de error que son parte normal del flujo de OAuth
      // -3: ABORTED - Común durante redirecciones OAuth
      // -2: FAILED - A veces ocurre durante transiciones
      // 0: HTTP_OK - No es realmente un error
      const nonCriticalErrors = [-3, -2, 0];
      
      // Si es un error durante la autenticación, intentar recuperarse
      if (isAuthenticating && isMainFrame && !nonCriticalErrors.includes(errorCode)) {
        // Si hay una ventana de autenticación abierta, cerrarla
        if (authWindow && !authWindow.isDestroyed()) {
          try {
            authWindow.close();
          } catch (e) {
            // Silenciar errores
          }
          authWindow = null;
        }
        
        // Si tenemos una URL objetivo guardada, intentar volver a ella
        if (authTargetUrl) {
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              // Usar carga diferida para evitar problemas de caché
              mainWindow.loadURL(authTargetUrl + (authTargetUrl.includes('?') ? '&' : '?') + 'recovery=true&t=' + Date.now());
              
              // Resetear estado de autenticación con retraso para asegurar carga
              setTimeout(() => {
                isAuthenticating = false;
                authTargetUrl = null;
              }, 3000);
            }
          }, 1500);
        } else {
          // Si no hay URL objetivo, volver a Claude
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL('https://claude.ai/?recovery=true&t=' + Date.now());
              
              // Resetear estado de autenticación con retraso para asegurar carga
              setTimeout(() => {
                isAuthenticating = false;
              }, 3000);
            }
          }, 1500);
        }
        
        // Ejecutar limpieza de sesión para resolver posibles problemas con cookies corruptas
        cleanupSessionData();
      }
      // Para otros tipos de errores menos críticos o durante procesos normales
      else if (isMainFrame && !nonCriticalErrors.includes(errorCode)) {
        // Solo para errores de conectividad o DNS, intentar recargar después de un tiempo
        if (errorCode === -105 || errorCode === -106 || errorCode === -118) {
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.reload();
            }
          }, 3000);
        }
      }
    });

    // Manejar errores de renderizado
    mainWindow.webContents.on('render-process-gone', (event, details) => {
      // Si la aplicación se cierra inesperadamente durante la autenticación
      if (isAuthenticating) {
        // Crear una nueva ventana
        createWindow();
        
        // Intentar volver a Claude
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL('https://claude.ai');
            isAuthenticating = false;
          }
        }, 1000);
      }
    });

    // Verificar conectividad antes de cargar
    checkConnectivity();

    // Manejar cierre de ventana (cuando realmente se cierra, no solo se oculta)
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  // Verificar conectividad a Claude
  function checkConnectivity() {
    let retryCount = 0;
    const maxRetries = 3;
    
    function tryConnection() {
      const request = net.request({
        method: 'HEAD',
        url: 'https://claude.ai'
      });
      
      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          // Verificar autenticación en respuesta 401/403
          if (response.statusCode === 401 || response.statusCode === 403) {
            // Marcar para intentar reautenticar
            isAuthenticating = false;
            
            // Si tenemos ventana, intentar refrescar
            if (mainWindow && !mainWindow.isDestroyed()) {
              setTimeout(() => {
                mainWindow.loadURL('https://claude.ai');
              }, 1000);
            }
          } 
          // Reintentar para otros códigos de error
          else if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(tryConnection, 2000);
          }
        }
      });
      
      request.on('error', (error) => {
        // Reintentar en caso de error de red
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(tryConnection, 2000);
        } else {
          // Mostrar mensaje de error en la ventana principal después de agotar reintentos
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.executeJavaScript(`
              if (document.getElementById('error')) {
                document.getElementById('error').style.display = 'block';
                const errorMsg = document.querySelector('#error p');
                if (errorMsg) {
                  errorMsg.textContent = 'Error de conexión a Claude. Comprueba tu conexión a Internet.';
                }
              }
            `).catch(() => {});
          }
        }
      });
      
      request.end();
    }
    
    // Iniciar el proceso de verificación
    tryConnection();
  }

  // Configurar IPC
  setupIPC();

  // Limpiar caché y sesiones potencialmente corruptas
  function cleanupSessionData() {
    return new Promise((resolve) => {
      // Eliminar solo cookies de sesión que puedan estar causando problemas
      session.defaultSession.cookies.get({})
        .then(cookies => {
          const authProblematicCookies = cookies.filter(cookie => 
            (cookie.domain.includes('accounts.google.com') && cookie.session) ||
            (cookie.name.includes('oauth') || cookie.name.includes('auth')) && 
            cookie.session && !cookie.expirationDate
          );
          
          const promises = authProblematicCookies.map(cookie => {
            const url = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
            return session.defaultSession.cookies.remove(url, cookie.name);
          });
          
          Promise.all(promises)
            .then(() => {
              resolve();
            })
            .catch(() => {
              resolve(); // Continuamos incluso si hay error
            });
        })
        .catch(() => {
          resolve(); // Continuamos incluso si hay error
        });
    });
  }

  // Manejar errores no capturados para evitar cierres inesperados
  process.on('uncaughtException', (error) => {
    // No cerrar la aplicación, solo registrar el error
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        console.error('Error no capturado en la aplicación:', ${JSON.stringify(error.toString())});
      `).catch(() => {});
    }
  });

  // Manejar promesas rechazadas no capturadas
  process.on('unhandledRejection', (reason, promise) => {
    // No cerrar la aplicación, solo registrar el error
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        console.error('Promesa rechazada no manejada:', ${JSON.stringify(reason.toString())});
      `).catch(() => {});
    }
  });

  // Eventos de la aplicación
  app.on('ready', () => {
    createWindow();

    // Crear icono de la bandeja del sistema
    const iconPath = path.join(__dirname, 'icons', 'icon.png'); // Asegúrate que este icono exista
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);

    // Crear menú contextual para el icono de la bandeja
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Mostrar/Ocultar Claude',
        click: () => {
          if (mainWindow) {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Salir',
        click: () => {
          app.isQuitting = true; // Marcar que estamos saliendo
          app.quit(); // Salir de la aplicación
        }
      }
    ]);

    tray.setToolTip('Claude');
    tray.setContextMenu(contextMenu);

    // Mostrar/ocultar ventana al hacer clic en el icono de la bandeja
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });

    // Configurar atajos de teclado globales sin mostrar la barra de menú
    const menu = Menu.buildFromTemplate([
      {
        label: 'Aplicación',
        submenu: [
          { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: () => { if (mainWindow) mainWindow.reload(); } },
          { label: 'Abrir DevTools', accelerator: 'CmdOrCtrl+Shift+I', click: () => { if (mainWindow) mainWindow.webContents.openDevTools(); } },
          { type: 'separator' },
          { label: 'Salir', accelerator: 'CmdOrCtrl+Q', click: () => { app.quit(); } }
        ]
      },
      {
        label: 'Edición',
        submenu: [
          { label: 'Deshacer', role: 'undo' },
          { label: 'Rehacer', role: 'redo' },
          { type: 'separator' },
          { label: 'Cortar', role: 'cut' },
          { label: 'Copiar', role: 'copy' },
          { label: 'Pegar', role: 'paste' },
          { label: 'Seleccionar todo', role: 'selectAll' }
        ]
      }
    ]);
    
    // Creamos un menú invisible para mantener los atajos de teclado
    // pero ocultamos la barra de menú para la interfaz
    Menu.setApplicationMenu(menu);
  });

  // Evitar que la aplicación se cierre cuando todas las ventanas están cerradas (ocultas)
  app.on('window-all-closed', () => {
    // No hacer nada, la aplicación debe permanecer activa en la bandeja
  });

  // Evento antes de salir de la aplicación
  app.on('before-quit', () => {
    app.isQuitting = true; // Asegurarse de marcar que estamos saliendo
    if (tray) {
      tray.destroy(); // Destruir el icono de la bandeja al salir
    }
  });

  app.on('activate', () => {
    // En macOS, re-crear la ventana si no existe y se hace clic en el icono del dock
    if (mainWindow === null) {
      createWindow();
    } else {
      // Si la ventana existe pero está oculta, mostrarla
      mainWindow.show();
    }
  });
}