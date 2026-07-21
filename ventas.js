module.exports = {
    title: "Ventas",
    description: "Registro de ventas y facturacion.",
    table: "ventas",
    id: "id_venta",
    fields: [
        { name: "numero_factura", label: "Número Factura", required: true },
        { name: "id_cliente", label: "ID Cliente", type: "number" },
        { name: "id_usuario", label: "ID Usuario", type: "number", required: true },
        { name: "subtotal", label: "Subtotal", type: "number", step: "0.01", required: true },
        { name: "descuento", label: "Descuento", type: "number", step: "0.01" },
        { name: "impuesto", label: "Impuesto", type: "number", step: "0.01" },
        { name: "total", label: "Total", type: "number", step: "0.01", required: true },
        { name: "metodo_pago", label: "Método de Pago", type: "select", options: ["Efectivo", "Tarjeta", "Transferencia", "Mixto"], required: true },
        { name: "monto_recibido", label: "Monto Recibido", type: "number", step: "0.01" },
        { name: "cambio", label: "Cambio", type: "number", step: "0.01" },
        { name: "puntos_generados", label: "Puntos Generados", type: "number" },
        { name: "puntos_utilizados", label: "Puntos Utilizados", type: "number" },
        { name: "estado", label: "Estado", type: "select", options: ["Completada", "Anulada"] }
    ]
};
