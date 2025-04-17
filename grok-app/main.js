const { app, BrowserWindow, Menu, session, shell, dialog, Tray } = require('electron'); // Added Tray
app.disableHardwareAcceleration();
const path = require('path');

let mainWindow;
let tray = null; // Added tray variable
let isQuitting = false; // Added quitting flag

// --- SINGLE INSTANCE LOCK ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	app.quit();
} else {
	app.on('second-instance', (event, commandLine, workingDirectory) => {
		// Someone tried to run a second instance, we should focus our window.
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.show();
			mainWindow.focus();
		}
	});

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

		const allowedDomains = ['grok.com'];
		const allowedLoginDomains = [/grok\.com$/, /x\.ai$/, 'accounts.google.com', 'login.live.com', 'appleid.apple.com'];

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

		mainWindow.loadURL('https://grok.com/');
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

		// Prevent closing, hide instead
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

	app.on('ready', () => {
		createWindow();

		// Create Tray icon
		const iconPath = path.join(__dirname, 'icons', 'icon.png'); // Ensure you have an icon here
		tray = new Tray(iconPath);
		tray.setToolTip('Grok App');

		const contextMenu = Menu.buildFromTemplate([
			{
				label: 'Show/Hide Grok',
				click: () => {
					mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
				}
			},
			{
				label: 'Quit',
				click: () => {
					isQuitting = true;
					app.quit();
				}
			}
		]);

		tray.setContextMenu(contextMenu);

		// Show window when tray icon is clicked (optional, adjust as needed)
		tray.on('click', () => {
			mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
		});
	});

	// Keep app running in tray even if window is closed
	app.on('window-all-closed', () => {
		// On macOS it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		// On other platforms, we might want to keep it in tray unless explicitly quit
		// if (process.platform !== 'darwin') {
		//   app.quit(); // Original behavior - remove or comment out for tray persistence
		// }
	});

	app.on('activate', () => {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		// Show existing window or create if null
		if (mainWindow === null) {
			createWindow();
		} else {
			mainWindow.show();
		}
	});

	// Ensure app quits properly before exit
	app.on('before-quit', () => {
		isQuitting = true;
	});
}