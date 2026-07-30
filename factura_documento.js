const invoice = document.getElementById("invoice");
let db;
let ipcRenderer;

try {
    db = require("./database").promise();
    ({ ipcRenderer } = require("electron"));
} catch (error) {
    invoice.innerHTML = `
        <p class="error">
            No se pudo iniciar la factura. Reinicie la aplicación e intente nuevamente.
        </p>`;
    throw error;
}

const saleId = Number(
    new URLSearchParams(window.location.search).get("id")
);

document.getElementById("backButton").addEventListener("click", () => {
    window.close();
});

document.getElementById("pdfButton").addEventListener("click", async () => {
    const number = invoice.dataset.invoiceNumber || "factura";
    const result = await ipcRenderer.invoke("generate-report-pdf", {
        suggestedName: `${number}.pdf`,
        landscape: false,
    });
    if (result.saved) {
        window.alert("Factura guardada correctamente.");
    }
});

function money(value) {
    return `L ${Number(value || 0).toFixed(2)}`;
}

function dateTime(value) {
    return new Intl.DateTimeFormat("es-HN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function loadInvoice() {
    if (!Number.isInteger(saleId) || saleId <= 0) {
        throw new Error("La factura solicitada no es válida.");
    }

    const [sales] = await db.execute(
        `SELECT v.*, CONCAT(u.nombre, ' ', u.apellido) AS responsable,
                COALESCE(
                    CONCAT(c.nombre, ' ', c.apellido),
                    'Consumidor final'
                ) AS cliente,
                c.identidad AS dni_cliente
         FROM ventas v
         INNER JOIN usuarios u ON v.id_usuario = u.id_usuario
         LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
         WHERE v.id_venta = ?
         LIMIT 1`,
        [saleId]
    );
    if (!sales.length) {
        throw new Error("No se encontró la factura.");
    }

    const sale = sales[0];
    const [items] = await db.execute(
        `SELECT m.codigo, m.nombre, dv.presentacion, dv.cantidad,
                dv.precio_unitario, dv.subtotal
         FROM detalles_venta dv
         INNER JOIN medicamentos m
            ON dv.id_medicamento = m.id_medicamento
         WHERE dv.id_venta = ?
         ORDER BY dv.id_detalle_venta`,
        [saleId]
    );

    invoice.dataset.invoiceNumber = sale.numero_factura;
    invoice.innerHTML = `
        <header class="receipt__header">
            <img class="receipt__logo" src="./assets/logo-farmacia-josue.svg" alt="">
            <h1>Farmacia Josue</h1>
            <p>Salud, servicio y confianza</p>
            <p>Jacaleapa, El Paraíso, Honduras</p>
        </header>

        <div class="receipt__title">FACTURA DE VENTA</div>

        <dl class="receipt__meta">
            <dt>Factura:</dt><dd>${escapeHtml(sale.numero_factura)}</dd>
            <dt>Fecha:</dt><dd>${escapeHtml(dateTime(sale.fecha_venta))}</dd>
            <dt>Cliente:</dt><dd>${escapeHtml(sale.cliente)}</dd>
            <dt>DNI:</dt><dd>${escapeHtml(sale.dni_cliente || "No registrado")}</dd>
            <dt>Atendió:</dt><dd>${escapeHtml(sale.responsable)}</dd>
        </dl>

        <table>
            <thead>
                <tr>
                    <th>Descripción</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((item) => `
                    <tr>
                        <td>
                            ${escapeHtml(item.codigo)} -
                            ${escapeHtml(item.nombre)}
                            <br>${escapeHtml(item.presentacion)}
                        </td>
                        <td>${escapeHtml(item.cantidad)}</td>
                        <td>${money(item.precio_unitario)}</td>
                        <td>${money(item.subtotal)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>

        <section class="receipt__totals">
            <div class="receipt__total-row">
                <span>Subtotal</span><strong>${money(sale.subtotal)}</strong>
            </div>
            <div class="receipt__total-row">
                <span>Descuento</span><strong>-${money(sale.descuento)}</strong>
            </div>
            <div class="receipt__total-row">
                <span>Impuesto</span><strong>${money(sale.impuesto)}</strong>
            </div>
            <div class="receipt__total-row receipt__total-row--main">
                <span>TOTAL</span><strong>${money(sale.total)}</strong>
            </div>
            <div class="receipt__total-row">
                <span>Método de pago</span>
                <strong>${escapeHtml(sale.metodo_pago)}</strong>
            </div>
            <div class="receipt__total-row">
                <span>Monto recibido</span><strong>${money(sale.monto_recibido)}</strong>
            </div>
            <div class="receipt__total-row">
                <span>Cambio</span><strong>${money(sale.cambio)}</strong>
            </div>
            <div class="receipt__total-row">
                <span>Puntos generados</span>
                <strong>${escapeHtml(sale.puntos_generados || 0)}</strong>
            </div>
            <div class="receipt__total-row">
                <span>Puntos utilizados</span>
                <strong>${escapeHtml(sale.puntos_utilizados || 0)}</strong>
            </div>
        </section>

        <footer class="receipt__footer">
            <p><strong>¡Gracias por su compra!</strong></p>
            <p>Conserve esta factura para cualquier consulta.</p>
            <div class="receipt__barcode" aria-hidden="true"></div>
            <p>${escapeHtml(sale.numero_factura)}</p>
        </footer>`;
}

loadInvoice().catch((error) => {
    invoice.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
});
