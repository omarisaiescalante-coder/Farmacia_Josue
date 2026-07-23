module.exports = {
    title: "Recetas",
    description: "Registro de recetas medicas de clientes.",
    table: "recetas",
    id: "id_receta",
    fields: [
        { name: "codigo_receta", label: "Código Receta", required: true },
        {
            name: "id_cliente",
            label: "DNI Cliente",
            type: "client-dni",
            displayName: "identidad_cliente",
            showInTable: true,
            required: true
        },
        { name: "nombre_medico", label: "Nombre Médico", required: true },
        { name: "numero_colegiacion", label: "Número Colegiación" },
        { name: "clinica_hospital", label: "Clínica/Hospital", wide: true , required: true },
        { name: "fecha_emision", label: "Fecha Emisión", type: "date", required: true },
        { name: "fecha_vencimiento", label: "Fecha Vencimiento", type: "date" },
        { name: "diagnostico", label: "Diagnóstico", wide: true },
        { name: "observaciones", label: "Observaciones", type: "textarea", full: true },
        { name: "estado", label: "Estado", type: "select", options: ["Pendiente", "Utilizada", "Vencida", "Cancelada"] }
    ]
};
