const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Desactivar aceleración por hardware completamente
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

// Desactivar completamente todas las características de audio
app.commandLine.appendSwitch('disable-audio');
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess,AudioOutputDevices');
app.commandLine.appendSwitch('disable-speech-api');
app.commandLine.appendSwitch('disable-webaudio');
app.commandLine.appendSwitch('mute-audio');

// Opciones adicionales para mejorar estabilidad
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-renderer-accessibility');
app.commandLine.appendSwitch('disable-hang-monitor');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('no-sandbox'); // Cuidado: solo para desarrollo
app.commandLine.appendSwitch('disable-http2');

// Variable para la ventana principal
let mainWindow = null;

// Función para crear ventana principal
function createWindow() {
  // Crear la ventana del navegador
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // No mostrar hasta que esté lista
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'preload.js'),
      webSecurity: false, // Desactivar seguridad web para evitar problemas de CSP
      allowRunningInsecureContent: true, 
      webviewTag: true, // Permitir el uso de webview
      sandbox: false,
      backgroundThrottling: false
    },
    icon: path.join(__dirname, 'icons', 'icon.png'),
    backgroundColor: '#343541'
  });

  // Configurar sesión para permitir todos los orígenes
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders, Origin: '*' } });
  });

  // Configurar respuestas para permitir CORS
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['*'],
        'Access-Control-Allow-Headers': ['*']
      }
    });
  });

  // Cargar nuestro HTML local
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Ocultar menú
  mainWindow.setMenu(null);

  // Mostrar la ventana cuando esté lista para evitar destellos blancos
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Crear menú contextual
  mainWindow.webContents.on('context-menu', (_, params) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Copiar', role: 'copy', enabled: params.selectionText && params.selectionText.length > 0 },
      { label: 'Pegar', role: 'paste', enabled: params.isEditable },
      { type: 'separator' },
      { label: 'Recargar', click: () => mainWindow.reload() },
      { label: 'Forzar recarga', click: () => mainWindow.webContents.reloadIgnoringCache() },
      { type: 'separator' },
      { label: 'Inspeccionar elemento', click: () => mainWindow.webContents.inspectElement(params.x, params.y) }
    ]);
    menu.popup();
  });

  // Manejar enlaces externos
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.includes('file://') && !url.includes('chat.qwen.ai')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Manejar errores
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error(`Proceso de renderizado terminado: ${details.reason}`);
    if (details.reason !== 'clean-exit') {
      dialog.showErrorBox('Error', 
        'El proceso de renderizado ha fallado. La aplicación se reiniciará.');
      
      if (mainWindow) {
        mainWindow.destroy();
        createWindow();
      }
    }
  });

  // Manejar cuelgues
  mainWindow.webContents.on('unresponsive', () => {
    dialog.showMessageBox({
      type: 'warning',
      buttons: ['Esperar', 'Forzar reinicio'],
      title: 'Aplicación no responde',
      message: 'La aplicación no responde. ¿Desea esperar o forzar el reinicio?',
      defaultId: 0
    }).then(result => {
      if (result.response === 1 && mainWindow) {
        mainWindow.destroy();
        createWindow();
      }
    });
  });

  // Limpiar referencia cuando se cierre la ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Escuchar IPC para recargar la ventana
ipcMain.on('reload-app', () => {
  if (mainWindow) mainWindow.reload();
});

// Escuchar IPC para reportar errores
ipcMain.on('report-error', (_, errorMessage) => {
  console.error(`Error reportado desde el renderer: ${errorMessage}`);
  dialog.showErrorBox('Error', errorMessage);
});

// Escuchar IPC para abrir enlaces externos
ipcMain.handle('open-external', (_, url) => {
  return shell.openExternal(url);
});

// Iniciar la aplicación
app.whenReady().then(() => {
  createWindow();

  // Registrar protocolo personalizado
  if (!app.isDefaultProtocolClient('qwen')) {
    app.setAsDefaultProtocolClient('qwen');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Salir cuando se cierren todas las ventanas (excepto en macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
  // Registrar error pero no cerrar la aplicación
});