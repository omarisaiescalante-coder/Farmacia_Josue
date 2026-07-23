const {
    app,
    BrowserWindow,
    dialog,
    ipcMain
} = require('electron');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 750,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    win.loadFile('Index.html');
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

ipcMain.handle(
    'generate-report-pdf',
    async (event, suggestedName) => {
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
            landscape: true
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
