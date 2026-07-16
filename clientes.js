module.exports = {
    title: "Clientes",
    description: "Administracion de clientes registrados.",
    table: "clientes",
    id: "id_cliente",
    fields: [
        { name: "codigo_cliente", label: "Codigo cliente", required: true },
        { name: "nombre", label: "Nombre", required: true },
        { name: "apellido", label: "Apellido", required: true },
        { name: "identidad", label: "Identidad" },
        { name: "telefono", label: "Telefono" },
        { name: "correo", label: "Correo", type: "email" },
        { name: "direccion", label: "Direccion", wide: true },
        { name: "fecha_nacimiento", label: "Fecha nacimiento", type: "date" },
        { name: "puntos_acumulados", label: "Puntos acumulados", type: "number" },
        { name: "estado", label: "Estado", type: "select", options: ["Activo", "Inactivo"] }
    ]
};
