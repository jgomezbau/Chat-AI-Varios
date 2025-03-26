const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
app.disableHardwareAcceleration();
const path = require('path');

let mainWindow;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			devTools: true
		},
		icon: path.join(__dirname, 'icons', 'icon.png')
	});

	const allowedDomains = ['chat.qwenlm.ai'];
	const allowedLoginDomains = [/qwenlm\.ai$/, /qwen\.ai$/, /github\.com$/, 'accounts.google.com', 'login.live.com', 'appleid.apple.com'];

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

	mainWindow.loadURL('https://chat.qwenlm.ai/');
	mainWindow.setMenu(null);

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

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

app.on('ready', createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });
