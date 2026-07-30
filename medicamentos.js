module.exports = {
    title: "Medicamentos",
    description: "Catálogo general de medicamentos.",
    table: "medicamentos",
    id: "id_medicamento",
    fields: [
        { name: "codigo", label: "Código", readOnly: true },
        { name: "nombre", label: "Nombre", required: true },
        { name: "categoria", label: "Categoría" },
        { name: "presentacion", label: "Presentación", wide: true },
        { name: "estado", label: "Estado", type: "select", options: ["Disponible","Inactivo"] }
    ]
};