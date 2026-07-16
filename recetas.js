module.exports = {
    title: "Recetas",
    description: "Registro de recetas medicas de clientes.",
    table: "recetas",
    id: "id_receta",
    fields: [
        { name: "codigo_receta", label: "Codigo receta", required: true },
        { name: "id_cliente", label: "ID cliente", type: "number", required: true },
        { name: "nombre_medico", label: "Nombre medico", required: true },
        { name: "numero_colegiacion", label: "Numero colegiacion" },
        { name: "clinica_hospital", label: "Clinica hospital", wide: true },
        { name: "fecha_emision", label: "Fecha emision", type: "date", required: true },
        { name: "fecha_vencimiento", label: "Fecha vencimiento", type: "date" },
        { name: "diagnostico", label: "Diagnostico", wide: true },
        { name: "imagen_receta", label: "Imagen receta", wide: true },
        { name: "observaciones", label: "Observaciones", type: "textarea", full: true },
        { name: "estado", label: "Estado", type: "select", options: ["Pendiente", "Utilizada", "Vencida", "Cancelada"] }
    ]
};
