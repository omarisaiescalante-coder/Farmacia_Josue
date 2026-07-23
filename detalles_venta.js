module.exports = {
    title: "Detalles de venta",
    description: "Medicamentos incluidos en cada venta.",
    table: "detalles_venta",
    id: "id_detalle_venta",
    fields: [
        { name: "id_venta", label: "ID venta", type: "number", min: 1, required: true },
        { name: "id_medicamento", label: "ID medicamento", type: "number", min: 1, required: true },
        { name: "cantidad", label: "Cantidad", type: "number", min: 1, required: true },
        { name: "precio_unitario", label: "Precio unitario", type: "number", min: 0, step: "0.01", required: true },
        { name: "descuento", label: "Descuento", type: "number", min: 0, step: "0.01" },
        { name: "subtotal", label: "Subtotal", type: "number", min: 0, step: "0.01", required: true }
    ]
};
