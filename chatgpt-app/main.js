const { app, BrowserWindow, Menu, session, shell, dialog, clipboard, Tray, nativeImage } = require('electron');
const path = require('path');
const { setupIPC } = require('./src/preload/ipc');

// --- Instancia única ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv, workingDirectory) => {
    // Si la ventana principal existe, mostrarla y enfocarla
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Unificar el nombre de la app para la carpeta de configuración
  app.setName('ChatGPT'); // Asegúrate de que sea 'ChatGPT' y no 'Electron'

  // Desactivar aceleración por hardware (según configuración original)
  app.disableHardwareAcceleration();

  // Variable para mantener la referencia a la ventana principal y al tray
  let mainWindow;
  let tray = null;

  // Dominios permitidos para el flujo de inicio de sesión
  const allowedLoginDomains = [
    /openai\.com$/, // Incluye chat.openai.com, auth0.openai.com, etc.
    'chatgpt.com', // Nuevo dominio de ChatGPT
    'accounts.google.com',
    'login.microsoft.com', // Microsoft
    'login.microsoftonline.com', // Microsoft
    'login.live.com', // Microsoft
    'appleid.apple.com' // Apple ID
  ];

  // URL base de la aplicación
  const appBaseUrl = 'https://chat.openai.com/';
  // User Agent string de Firefox en Linux
  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0';

  // Crear ventana principal
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'src', 'preload', 'preload.js'),
        devTools: true,
        permissions: ['media'],
        spellcheck: true,
        // Habilitar acceso al portapapeles
        enableWebSQL: false,
        enableRemoteModule: false,
        sandbox: false,
        webSecurity: true
      },
      icon: path.join(__dirname, 'icons', 'icon.png'),
      title: 'ChatGPT' // No mencionar Electron
    });

    // Crear ventana secundaria para login OAuth
    function createLoginWindow(url) {
      const loginWindow = new BrowserWindow({
        width: 500,
        height: 700,
        parent: mainWindow,
        modal: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          devTools: true,
          sandbox: false,
          webSecurity: true
        }
      });
      loginWindow.loadURL(url);
      // Opcional: cerrar la ventana de login cuando termine el flujo
      loginWindow.webContents.on('will-redirect', (event, newUrl) => {
        if (newUrl.startsWith(appBaseUrl)) {
          mainWindow.loadURL(newUrl);
          loginWindow.close();
        }
      });
    }

    // Configurar el manejador de apertura de ventanas
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      const hostname = new URL(url).hostname;
      if (allowedLoginDomains.some(domain => domain instanceof RegExp ? domain.test(hostname) : hostname.includes(domain))) {
        // Abrir en una nueva ventana de Electron (no reemplazar mainWindow)
        createLoginWindow(url);
      } else {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    // Configurar navegación
    mainWindow.webContents.on('will-navigate', (event, url) => {
      const targetUrl = new URL(url);
      const hostname = targetUrl.hostname;

      // 1. Permitir navegación dentro de la URL base de la aplicación (incluye callbacks)
      if (url.startsWith(appBaseUrl)) {
        return; // Permitir la navegación
      }

      // 2. Permitir navegación a dominios de inicio de sesión conocidos
      if (allowedLoginDomains.some(domain => domain instanceof RegExp ? domain.test(hostname) : hostname.includes(domain))) {
        return; // Permitir la navegación
      }

      // 3. Para cualquier otra URL, prevenir y abrir externamente
      event.preventDefault();
      shell.openExternal(url);
    });

    // Cargar URL de ChatGPT con userAgent de Firefox
    mainWindow.loadURL(appBaseUrl, { userAgent: userAgent });

    // Eliminar menú visible en la ventana
    mainWindow.setMenuBarVisibility(false);
    mainWindow.autoHideMenuBar = true;

    // Configurar permisos
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['media', 'clipboard-read', 'clipboard-sanitized-write'];
      callback(allowedPermissions.includes(permission));
    });

    // Interceptar errores de certificado
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
      // Para desarrollo, se podría aceptar certificados no válidos
      // En producción, esto debe estar deshabilitado
      if (process.env.NODE_ENV === 'development') {
        event.preventDefault();
        callback(true);
      } else {
        callback(false);
      }
    });

    // Menú contextual personalizado
    const contextMenuTemplate = [
      { label: 'Cortar', role: 'cut' },
      { label: 'Copiar', role: 'copy' },
      { label: 'Pegar', role: 'paste' },
      { label: 'Seleccionar todo', role: 'selectAll' },
      { type: 'separator' },
      { label: 'Recargar', click: () => { mainWindow.reload(); } },
      { label: 'Imprimir', click: () => { mainWindow.webContents.print(); } },
      { 
        label: 'Inspeccionar', 
        click: (_, params) => { 
          mainWindow.webContents.inspectElement(params.x, params.y); 
        } 
      }
    ];

    // Agregar listener para menú contextual
    mainWindow.webContents.on('context-menu', (event, params) => {
      contextMenuTemplate[0].enabled = params.isEditable;
      contextMenuTemplate[1].enabled = params.selectionText && params.selectionText.trim() !== '';
      contextMenuTemplate[2].enabled = params.isEditable;
      
      const menu = Menu.buildFromTemplate(contextMenuTemplate);
      menu.popup();
    });

    // Interceptar comandos de teclado
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Interceptar comandos de copiado/pegado
      if (input.control || input.meta) {
        if (input.key.toLowerCase() === 'c') {
          // La lógica de copiado mejorada está en preload.js
        }
        else if (input.key.toLowerCase() === 'v') {
          // La lógica de pegado está en preload.js
        }
      }
    });

    // Manejar cierre de ventana para ocultar en lugar de salir (excepto macOS)
    mainWindow.on('close', (event) => {
      if (process.platform !== 'darwin' && !app.isQuiting) {
        event.preventDefault();
        mainWindow.hide();
      }
      // Si app.isQuiting es true, se permite el cierre normal
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
      // No destruir el tray aquí, se hace en before-quit
    });
  }

  // Configurar IPC
  setupIPC();

  // Eventos de la aplicación
  app.on('ready', () => {
    createWindow();

    // Crear icono de Tray
    const iconPath = path.join(__dirname, 'icons', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);

    // Crear menú contextual para el Tray
    const trayContextMenu = Menu.buildFromTemplate([
      {
        label: 'Mostrar/Ocultar ChatGPT',
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
          app.isQuiting = true; // Marcar que estamos saliendo intencionalmente
          if (mainWindow) {
            mainWindow.close(); // Esto disparará el evento 'close' y permitirá salir
          }
          // Si no hay ventana, salir directamente
          app.quit();
        }
      }
    ]);

    tray.setToolTip('ChatGPT App');
    tray.setContextMenu(trayContextMenu);

    // Mostrar/ocultar ventana al hacer clic en el icono del tray
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

  app.on('window-all-closed', () => {
    // En macOS, es común que la aplicación permanezca activa sin ventanas.
    // En otros sistemas, si no estamos saliendo intencionalmente, no salimos.
    if (process.platform !== 'darwin' && !app.isQuiting) {
       // No hacer nada, la app sigue en el tray
    } else if (process.platform === 'darwin') {
       // Comportamiento estándar de macOS
    } else {
      app.quit(); // Salir si se marcó isQuiting
    }
  });

  app.on('activate', () => {
    // En macOS, re-crear la ventana si se hace clic en el icono del dock y no hay ventanas abiertas.
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show(); // Si la ventana existe pero está oculta, mostrarla
    }
  });

  // Limpiar el icono del tray antes de salir
  app.on('before-quit', () => {
    if (tray) {
      tray.destroy();
    }
  });
}