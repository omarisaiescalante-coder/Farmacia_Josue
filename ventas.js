module.exports = {
    title: "Ventas",
    description: "Registro de ventas y facturación.",
    table: "ventas",
    id: "id_venta",
    fields: [
        {
            name: "numero_factura",
            label: "Número Factura",
            autoInvoice: true,
            hidden: true,
            hideInTable: true,
            required: true
        },
        {
            name: "id_cliente",
            label: "DNI Cliente",
            type: "client-dni",
            exactLength: 15,
            format: "identity",
            placeholder: "Ej. 0706-2000-04500",
            displayName: "identidad_cliente",
            showInTable: true
        },
        { name: "id_usuario", label: "ID Usuario", type: "number", min: 1, required: true, currentUser: true, hidden: true },
        {
            name: "subtotal",
            label: "Subtotal",
            type: "number",
            min: 0,
            step: "0.01",
            automaticSubtotal: true,
            hideInTable: true,
            required: true
        },
        {
            name: "descuento",
            label: "Descuento automático",
            type: "number",
            min: 0,
            step: "0.01",
            automaticDiscount: true,
            hidden: true,
            hideInTable: true
        },
        {
            name: "impuesto",
            label: "Impuesto (15%)",
            type: "number",
            min: 0,
            step: "0.01",
            automaticTax: true,
            hidden: true,
            hideInTable: true
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
        { name: "monto_recibido", label: "Monto Recibido", type: "number", min: 0, step: "0.01", hideInTable: true },
        {
            name: "cambio",
            label: "Cambio",
            type: "number",
            min: 0,
            step: "0.01",
            automaticChange: true,
            hideInTable: true
        },
        {
            name: "puntos_generados",
            label: "Puntos Generados",
            type: "number",
            min: 0,
            automaticPoints: true,
            hideInTable: true
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
            defaultValue: "0",
            pointsDiscount: true,
            hideInTable: true
        },
        { name: "estado", label: "Estado", defaultValue: "Completada", hidden: true }
    ]
};
