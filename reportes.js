const db = require("./database").promise();
const { ipcRenderer } = require("electron");

const reportType = document.body.dataset.report;
const user = JSON.parse(sessionStorage.getItem("usuarioActivo") || "null");
const message = document.getElementById("message");
const reportTable = document.getElementById("reportTable");
let messageTimer = null;

if (!user || user.rol !== "Administrador") {
    window.alert("No tiene permiso para consultar este reporte.");
    window.location.replace("Index.html");
} else {
    document.getElementById("sessionUser").textContent =
        `${user.nombre} ${user.apellido} - ${user.rol}`;

    if (reportType === "ventas") initializeSalesReport();
    else initializeExpirationReport();
}

document.getElementById("backButton").addEventListener("click", () => {
    window.location.href =
        reportType === "ventas"
            ? "ventas.html"
            : "medicamentos.html";
});

document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("usuarioActivo");
    window.location.href = "Index.html";
});

document
    .getElementById("generatePdfButton")
    .addEventListener("click", generatePdf);

async function generatePdf() {
    try {
        const suggestedName =
            reportType === "ventas"
                ? `reporte-ventas-${document.getElementById("salesStartDate").value}-${document.getElementById("salesEndDate").value}.pdf`
                : `reporte-vencimientos-${document.getElementById("expirationStartDate").value}-${document.getElementById("expirationEndDate").value}.pdf`;

        const result = await ipcRenderer.invoke(
            "generate-report-pdf",
            suggestedName
        );

        if (result.saved) {
            if (messageTimer) {
                window.clearTimeout(messageTimer);
            }

            message.textContent =
                `PDF guardado correctamente en: ${result.filePath}`;
            message.className = "alert alert-success";

            messageTimer = window.setTimeout(() => {
                message.textContent = "";
                message.className = "alert d-none";
                messageTimer = null;
            }, 4000);
        }
    } catch (error) {
        showError(error);
    }
}

function showError(error) {
    if (messageTimer) {
        window.clearTimeout(messageTimer);
    }

    message.textContent = error.message;
    message.className = "alert alert-danger";

    messageTimer = window.setTimeout(() => {
        message.textContent = "";
        message.className = "alert d-none";
        messageTimer = null;
    }, 4000);
}

function currency(value) {
    return `L ${Number(value || 0).toFixed(2)}`;
}

function initializeSalesReport() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

    document.getElementById("salesStartDate").value =
        `${year}-${month}-01`;
    document.getElementById("salesEndDate").value =
        `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

    document
        .getElementById("generateSalesButton")
        .addEventListener("click", loadSalesReport);
    loadSalesReport();
}

function getNextDate(date) {
    const value = new Date(`${date}T00:00:00`);
    value.setDate(value.getDate() + 1);
    return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, "0"),
        String(value.getDate()).padStart(2, "0"),
    ].join("-");
}

async function loadSalesReport() {
    try {
        const start = document.getElementById("salesStartDate").value;
        const end = document.getElementById("salesEndDate").value;

        if (!start || !end) {
            throw new Error("Seleccione la fecha inicial y la fecha final.");
        }
        if (end < start) {
            throw new Error("La fecha final no puede ser anterior a la fecha inicial.");
        }

        const endExclusive = getNextDate(end);

        const [[income]] = await db.query(
            `SELECT COALESCE(SUM(total), 0) total
             FROM ventas
             WHERE estado = 'Completada'
                AND fecha_venta >= ?
                AND fecha_venta < ?`,
            [start, endExclusive]
        );
        const [[expenses]] = await db.query(
            `SELECT COALESCE(SUM(cantidad_inicial * precio_compra), 0) total
             FROM lote
             WHERE fecha_ingreso >= ?
                AND fecha_ingreso < ?`,
            [start, endExclusive]
        );
        const [monthly] = await db.query(
            `SELECT DATE(fecha_venta) fecha,
                    COUNT(*) ventas,
                    SUM(total) ingresos
             FROM ventas
             WHERE estado = 'Completada'
                AND fecha_venta >= ?
                AND fecha_venta < ?
             GROUP BY DATE(fecha_venta)
             ORDER BY fecha`,
            [start, endExclusive]
        );

        document.getElementById("periodStart").textContent =
            formatDate(start);
        document.getElementById("periodEnd").textContent =
            formatDate(end);
        document.getElementById("totalIngresos").textContent =
            currency(income.total);
        document.getElementById("totalEgresos").textContent =
            currency(expenses.total);
        renderTable(
            ["Fecha", "Ventas", "Ingresos"],
            monthly.map((row) => [
                formatDate(row.fecha),
                row.ventas,
                currency(row.ingresos),
            ])
        );
    } catch (error) {
        showError(error);
    }
}

function initializeExpirationReport() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

    document.getElementById("expirationStartDate").value =
        `${year}-${month}-01`;
    document.getElementById("expirationEndDate").value =
        `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

    document
        .getElementById("generateButton")
        .addEventListener("click", loadExpirationReport);
    loadExpirationReport();
}

async function loadExpirationReport() {
    try {
        const start =
            document.getElementById("expirationStartDate").value;
        const end =
            document.getElementById("expirationEndDate").value;

        if (!start || !end) {
            throw new Error("Seleccione la fecha inicial y la fecha final.");
        }
        if (end < start) {
            throw new Error(
                "La fecha final no puede ser anterior a la fecha inicial."
            );
        }

        const endExclusive = getNextDate(end);

        const [lots] = await db.query(
            `SELECT m.codigo, m.nombre, l.numero_lote,
                    l.cantidad_disponible, l.fecha_vencimiento,
                    CASE
                        WHEN l.fecha_vencimiento < ?
                        THEN 'Vencido'
                        ELSE 'Próximo a vencer'
                    END situacion
             FROM lote l
             INNER JOIN medicamentos m
                ON l.id_medicamento = m.id_medicamento
             WHERE l.fecha_vencimiento < ?
             ORDER BY l.fecha_vencimiento`,
            [start, endExclusive]
        );

        document.getElementById("expirationPeriodStart").textContent =
            formatDate(start);
        document.getElementById("expirationPeriodEnd").textContent =
            formatDate(end);

        renderTable(
            ["Código", "Medicamento", "Lote", "Cantidad", "Vencimiento", "Situación"],
            lots.map((row) => [
                row.codigo,
                row.nombre,
                row.numero_lote,
                row.cantidad_disponible,
                formatDate(row.fecha_vencimiento),
                row.situacion,
            ])
        );
    } catch (error) {
        showError(error);
    }
}

function formatDate(value) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value || "").replace(/T.*$/, "");
}

function renderTable(headers, data) {
    reportTable.replaceChildren();
    const table = document.createElement("table");
    table.className = "table table-striped table-hover align-middle mb-0";
    const header = table.createTHead().insertRow();
    header.className = "table-success";
    headers.forEach((text) => {
        const th = document.createElement("th");
        th.textContent = text;
        header.appendChild(th);
    });
    const body = table.createTBody();
    data.forEach((values) => {
        const row = body.insertRow();
        values.forEach((value) => {
            row.insertCell().textContent = value;
        });
    });
    if (!data.length) {
        const cell = body.insertRow().insertCell();
        cell.colSpan = headers.length;
        cell.className = "text-center text-secondary p-4";
        cell.textContent = "No se encontraron datos.";
    }
    reportTable.appendChild(table);
}
