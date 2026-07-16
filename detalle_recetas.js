module.exports = {
    title: "Detalle de recetas",
    description: "Medicamentos indicados en cada receta.",
    table: "detalle_recetas",
    id: "id_detalle_receta",
    fields: [
        { name: "id_receta", label: "ID receta", type: "number", required: true },
        { name: "id_medicamento", label: "ID medicamento", type: "number", required: true },
        { name: "cantidad_recetada", label: "Cantidad recetada", type: "number", required: true },
        { name: "dosis", label: "Dosis" },
        { name: "frecuencia", label: "Frecuencia" },
        { name: "duracion_tratamiento", label: "Duracion tratamiento" },
        { name: "indicaciones", label: "Indicaciones", type: "textarea", full: true },
        { name: "cantidad_dispensada", label: "Cantidad dispensada", type: "number" }
    ]
};
