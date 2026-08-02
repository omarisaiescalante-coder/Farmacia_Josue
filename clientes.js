module.exports = {
    title: "Clientes",
    description: "Administración de clientes registrados.",
    table: "clientes",
    id: "id_cliente",
    fields: [
        { name: "nombre", label: "Nombre", required: true },
        { name: "apellido", label: "Apellido", required: true },
        { name: "identidad", label: "Identidad", exactLength: 15, format: "identity", placeholder: "Ej. 0706-2000-04500", required: true },
        { name: "telefono", label: "Teléfono", exactLength: 9, format: "phone", placeholder: "Ej. 9999-9999", required: true },
        { name: "correo", label: "Correo", type: "email" },
        { name: "direccion", label: "Dirección", wide: true },
        { name: "fecha_nacimiento", label: "Fecha Nacimiento", type: "date", required: true },
        { name: "estado", label: "Estado", type: "select", options: ["Activo", "Inactivo"] }
    ]
};
