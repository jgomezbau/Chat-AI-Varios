const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            devTools: true // Habilita DevTools (opcional)
        },
        icon: path.join(__dirname, 'icons', 'icon.png') // Ruta del ícono
    });

    // Cargar la página de DeepSeek
    mainWindow.loadURL('https://chat.deepseek.com/');

    // Ocultar el menú principal
    mainWindow.setMenu(null);

    // Crear un menú contextual completo
    const contextMenuTemplate = [
        {
            label: 'Cortar',
            role: 'cut',
            enabled: false // Deshabilitado por defecto, se habilitará si hay texto seleccionado
        },
        {
            label: 'Copiar',
            role: 'copy',
            enabled: false // Deshabilitado por defecto, se habilitará si hay texto seleccionado
        },
        {
            label: 'Pegar',
            role: 'paste'
        },
        {
            label: 'Seleccionar todo',
            role: 'selectAll'
        },
        { type: 'separator' }, // Separador
        {
            label: 'Recargar',
            click: () => {
                mainWindow.reload(); // Recargar la página
            }
        },
        {
            label: 'Imprimir',
            click: () => {
                mainWindow.webContents.print(); // Abrir el diálogo de impresión
            }
        },
        {
            label: 'Inspeccionar',
            click: (_, params) => {
                mainWindow.webContents.inspectElement(params.x, params.y); // Abrir DevTools en la posición del clic
            }
        }
    ];

    // Habilitar el menú contextual personalizado
    mainWindow.webContents.on('context-menu', (event, params) => {
        const { isEditable, selectionText } = params;

        // Habilitar/deshabilitar opciones según el contexto
        contextMenuTemplate[0].enabled = isEditable; // Cortar
        contextMenuTemplate[1].enabled = selectionText.trim() !== ''; // Copiar
        contextMenuTemplate[2].enabled = isEditable; // Pegar

        // Construir y mostrar el menú contextual
        const menu = Menu.buildFromTemplate(contextMenuTemplate);
        menu.popup();
    });

    // Inyectar un script para eliminar el bloqueo del menú contextual
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
            document.addEventListener('contextmenu', (event) => {
                event.stopPropagation(); // Evitar que el sitio web bloquee el menú contextual
            }, true);
        `);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

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
