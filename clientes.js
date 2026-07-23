module.exports = {
    title: "Clientes",
    description: "Administracion de clientes registrados.",
    table: "clientes",
    id: "id_cliente",
    fields: [
        { name: "nombre", label: "Nombre", required: true },
        { name: "apellido", label: "Apellido", required: true },
        { name: "identidad", label: "Identidad", required: true },
        { name: "telefono", label: "Teléfono", required: true },
        { name: "correo", label: "Correo", type: "email" },
        { name: "direccion", label: "Dirección", wide: true },
        { name: "fecha_nacimiento", label: "Fecha Nacimiento", type: "date", required: true },
        { name: "puntos_acumulados", label: "Puntos Acumulados", type: "number", min: 0 },
        { name: "estado", label: "Estado", type: "select", options: ["Activo", "Inactivo"] }
    ]
};
