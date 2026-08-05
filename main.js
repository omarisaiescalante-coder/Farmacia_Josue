// Proceso principal de Electron: ventana, sesión temporal y exportación a PDF.
const {
    app,
    BrowserWindow,
    dialog,
    ipcMain
} = require('electron');
const fs = require('fs');

// Guarda el usuario autenticado mientras la aplicación permanece abierta.
let activeUser = null;

ipcMain.on('session:get-user', (event) => {
    event.returnValue = activeUser;
});

ipcMain.on('session:set-user', (_event, user) => {
    activeUser = user || null;
});

ipcMain.on('session:clear-user', () => {
    activeUser = null;
});

// Configura y abre la ventana principal de la aplicación.
function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 960,
        minHeight: 640,
        backgroundColor: '#f3f7f6',
        autoHideMenuBar: true,
        center: true,
        show: false,
        title: 'Farmacia Josue',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    win.once('ready-to-show', () => {
        win.show();
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes("factura_documento.html")) {
            return {
                action: "allow",
                overrideBrowserWindowOptions: {
                    width: 520,
                    height: 860,
                    minWidth: 420,
                    minHeight: 640,
                    autoHideMenuBar: true,
                    backgroundColor: "#dceef5",
                    title: "Factura",
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false,
                    }
                }
            };
        }

        return { action: "deny" };
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Recibe una solicitud del reporte y guarda su vista actual como PDF.
ipcMain.handle(
    'generate-report-pdf',
    async (event, request) => {
        const options = typeof request === "string"
            ? { suggestedName: request, landscape: true }
            : request;
        const suggestedName =
            options?.suggestedName || "reporte.pdf";
        const window = BrowserWindow.fromWebContents(
            event.sender
        );

        const result = await dialog.showSaveDialog(
            window,
            {
                title: 'Guardar reporte en PDF',
                defaultPath: suggestedName,
                filters: [
                    {
                        name: 'Documento PDF',
                        extensions: ['pdf']
                    }
                ]
            }
        );

        if (result.canceled || !result.filePath) {
            return {
                saved: false
            };
        }

        const pdf = await event.sender.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            landscape: options?.landscape ?? true
        });

        await fs.promises.writeFile(
            result.filePath,
            pdf
        );

        return {
            saved: true,
            filePath: result.filePath
        };
    }
);
