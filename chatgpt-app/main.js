const { app, BrowserWindow, Menu, session, shell, dialog, clipboard } = require('electron');
app.disableHardwareAcceleration();
const path = require('path');

let mainWindow;

function isAllowed(url, allowedPatterns) {
    try {
        const hostname = new URL(url).hostname;
        return allowedPatterns.some(pattern => {
            if (pattern instanceof RegExp) {
                return pattern.test(hostname);
            }
            return url.includes(pattern);
        });
    } catch (err) {
        return false;
    }
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

    const allowedDomains = ['openai.com'];
    
    const allowedLoginDomains = [/openai\.com$/, 'chatgpt.com', 'accounts.google.com', 'login.live.com','appleid.apple.com'];

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
    
    mainWindow.loadURL('https://chat.openai.com');
    mainWindow.setMenu(null);

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['media'];
        callback(allowedPermissions.includes(permission));
    });

    // Actualizar menú contextual para incluir "Inspeccionar"
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

    // Agregar listener para el clic derecho (context-menu)
    mainWindow.webContents.on('context-menu', (event, params) => {
        // Actualizar estado de opciones si fuera necesario
        contextMenuTemplate[0].enabled = params.isEditable;
        contextMenuTemplate[1].enabled = params.selectionText.trim() !== '';
        contextMenuTemplate[2].enabled = params.isEditable;
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