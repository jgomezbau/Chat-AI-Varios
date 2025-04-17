const { app, BrowserWindow, Menu, session, shell, dialog, Tray, nativeImage } = require('electron');
app.disableHardwareAcceleration();
const path = require('path');

let mainWindow;
let tray = null; // Tray global
let isQuitting = false; // <-- Añadido

// --- SINGLE INSTANCE LOCK ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Restaurar y enfocar la ventana principal si existe
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    // Asegurar que el tray esté activo
    if (!tray && app.isReady()) {
      createTray();
    }
  });

  app.on('ready', () => {
    createWindow();
    createTray();
  });
}

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, 'icons', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar/Ocultar DeepSeek',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        isQuitting = true; // <-- Añadido
        app.quit();
      }
    }
  ]);
  tray.setToolTip('DeepSeek');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			devTools: true,
			permissions: ['media'],
		},
		icon: path.join(__dirname, 'icons', 'icon.png')
	});
	
	const allowedDomains = ['deepseek.com'];
	const allowedLoginDomains = [/deepseek\.com$/, 'accounts.google.com', 'login.live.com', 'appleid.apple.com'];

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		const hostname = new URL(url).hostname;
		if (allowedLoginDomains.some(domain => domain instanceof RegExp ? domain.test(hostname) : hostname.includes(domain))) {
			mainWindow.loadURL(url);
		} else {
			shell.openExternal(url);
		}
		return { action: 'deny' };
	});

	mainWindow.webContents.on('will-navigate', (event, url) => {
		const hostname = new URL(url).hostname;
		if (!allowedLoginDomains.some(domain => domain instanceof RegExp ? domain.test(hostname) : hostname.includes(domain))) {
			event.preventDefault();
			shell.openExternal(url);
		}
	});

	mainWindow.loadURL('https://chat.deepseek.com/');
	mainWindow.setMenu(null);

	session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
		const allowedPermissions = ['media'];
		callback(allowedPermissions.includes(permission));
	});

	const contextMenuTemplate = [
		{ label: 'Cortar', role: 'cut', enabled: false },
		{ label: 'Copiar', role: 'copy', enabled: false },
		{ label: 'Pegar', role: 'paste' },
		{ label: 'Seleccionar todo', role: 'selectAll' },
		{ type: 'separator' },
		{ label: 'Recargar', click: () => { mainWindow.reload(); } },
		{ label: 'Imprimir', click: () => { mainWindow.webContents.print(); } },
		{ label: 'Inspeccionar', click: (_, params) => { mainWindow.webContents.inspectElement(params.x, params.y); } }
	];

	mainWindow.webContents.on('context-menu', (event, params) => {
		const { isEditable, selectionText } = params;
		contextMenuTemplate[0].enabled = isEditable;
		contextMenuTemplate[1].enabled = selectionText.trim() !== '';
		contextMenuTemplate[2].enabled = isEditable;
		const menu = Menu.buildFromTemplate(contextMenuTemplate);
		menu.popup();
	});

	mainWindow.on('close', (event) => {
		if (!isQuitting) {
			event.preventDefault();
			mainWindow.hide();
		}
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });
