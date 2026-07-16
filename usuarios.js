module.exports = {
    title: "Usuarios",
    description: "Administracion de usuarios del sistema.",
    table: "usuarios",
    id: "id_usuario",
    fields: [
        { name: "nombre", label: "Nombre", required: true },
        { name: "apellido", label: "Apellido", required: true },
        { name: "identidad", label: "Identidad" },
        { name: "telefono", label: "Telefono" },
        { name: "correo", label: "Correo", type: "email" },
        { name: "direccion", label: "Direccion", wide: true },
        { name: "nombre_usuario", label: "Nombre usuario", required: true },
        { name: "contrasena", label: "Contrasena", type: "password", required: true },
        { name: "rol", label: "Rol", type: "select", options: ["Administrador", "Cajero", "Farmaceutico"], required: true },
        { name: "estado", label: "Estado", type: "select", options: ["Activo", "Inactivo"] }
    ]
};
