module.exports = {
    title: "Ventas",
    description: "Registro de ventas y facturacion.",
    table: "ventas",
    id: "id_venta",
    fields: [
        {
            name: "numero_factura",
            label: "Número Factura",
            autoInvoice: true,
            hidden: true,
            required: true
        },
        {
            name: "id_cliente",
            label: "DNI Cliente",
            type: "client-dni",
            displayName: "identidad_cliente",
            showInTable: true
        },
        { name: "id_usuario", label: "ID Usuario", type: "number", min: 1, required: true },
        {
            name: "subtotal",
            label: "Subtotal",
            type: "number",
            min: 0,
            step: "0.01",
            automaticSubtotal: true,
            required: true
        },
        {
            name: "descuento",
            label: "Descuento automático",
            type: "number",
            min: 0,
            step: "0.01",
            automaticDiscount: true,
            hidden: true
        },
        {
            name: "impuesto",
            label: "Impuesto",
            type: "number",
            min: 0,
            step: "0.01",
            automaticTax: true,
            hidden: true
        },
        {
            name: "total",
            label: "Total",
            type: "number",
            min: 0,
            step: "0.01",
            automaticTotal: true,
            required: true
        },
        { name: "metodo_pago", label: "Método de Pago", type: "select", options: ["Efectivo", "Tarjeta", "Transferencia", "Mixto"], required: true },
        { name: "monto_recibido", label: "Monto Recibido", type: "number", min: 0, step: "0.01" },
        {
            name: "cambio",
            label: "Cambio",
            type: "number",
            min: 0,
            step: "0.01",
            automaticChange: true
        },
        {
            name: "puntos_generados",
            label: "Puntos Generados",
            type: "number",
            min: 0,
            automaticPoints: true
        },
        {
            name: "puntos_disponibles",
            label: "Puntos Disponibles",
            type: "number",
            virtual: true,
            readOnly: true
        },
        {
            name: "puntos_utilizados",
            label: "Puntos Utilizados",
            type: "number",
            min: 0,
            pointsDiscount: true
        },
        { name: "estado", label: "Estado", type: "select", options: ["Completada", "Anulada"] }
    ]
};
