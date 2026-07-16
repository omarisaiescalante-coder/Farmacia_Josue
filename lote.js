module.exports = {
    title: "Lotes",
    description: "Control de lotes de medicamentos.",
    table: "lote",
    id: "id_lote",
    fields: [
        { name: "id_medicamento", label: "ID medicamento", type: "number", required: true },
        { name: "numero_lote", label: "Numero lote", required: true },
        { name: "cantidad_inicial", label: "Cantidad inicial", type: "number", required: true },
        { name: "cantidad_disponible", label: "Cantidad disponible", type: "number", required: true },
        { name: "fecha_fabricacion", label: "Fecha fabricacion", type: "date" },
        { name: "fecha_vencimiento", label: "Fecha vencimiento", type: "date", required: true },
        { name: "precio_compra", label: "Precio compra", type: "number", step: "0.01" },
        { name: "estado", label: "Estado", type: "select", options: ["Disponible", "Agotado", "Vencido", "Retirado"] }
    ]
};
