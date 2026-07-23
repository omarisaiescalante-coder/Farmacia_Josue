module.exports = {
    title: "Lotes",
    description: "Control de lotes de medicamentos.",
    table: "lote",
    id: "id_lote",
    fields: [
        { name: "id_medicamento", label: "ID Medicamento", type: "number", min: 1, required: true },
        { name: "numero_lote", label: "Número Lote", required: true },
        { name: "cantidad_inicial", label: "Cantidad Inicial", type: "number", min: 0, required: true },
        { name: "cantidad_disponible", label: "Cantidad Disponible", type: "number", min: 0, required: true },
        { name: "fecha_fabricacion", label: "Fecha Fabricación", type: "date", required: true },
        { name: "fecha_vencimiento", label: "Fecha Vencimiento", type: "date", required: true },
        { name: "precio_compra", label: "Precio Compra", type: "number", min: 0, step: "0.01", required: true },
        { name: "estado", label: "Estado", type: "select", options: ["Disponible", "Agotado", "Vencido", "Retirado"] }
    ]
};
