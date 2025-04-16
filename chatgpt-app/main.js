const { app, BrowserWindow, Menu, session, shell, dialog, clipboard } = require('electron');
const path = require('path');
const { setupIPC } = require('./src/preload/ipc');

// Desactivar aceleración por hardware (según configuración original)
app.disableHardwareAcceleration();

// Variable para mantener la referencia a la ventana principal
let mainWindow;

// Dominios permitidos para navegación directa
const allowedDomains = ['openai.com', 'chat.openai.com'];
const allowedLoginDomains = [
  /openai\.com$/,
  'chatgpt.com',
  'accounts.google.com',
  'login.live.com',
  'appleid.apple.com'
];

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
    title: 'ChatGPT App'
  });

  // Configurar el manejador de apertura de ventanas
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const hostname = new URL(url).hostname;
    if (allowedLoginDomains.some(domain => domain instanceof RegExp ? domain.test(hostname) : hostname.includes(domain))) {
      mainWindow.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Configurar navegación
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const hostname = new URL(url).hostname;
    if (!allowedLoginDomains.some(domain => domain instanceof RegExp ? domain.test(hostname) : hostname.includes(domain))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Cargar URL de ChatGPT
  mainWindow.loadURL('https://chat.openai.com');
  
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

  // Manejar cierre de ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Configurar IPC
setupIPC();

// Eventos de la aplicación
app.on('ready', () => {
  createWindow();
  
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});