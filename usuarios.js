module.exports = {
    title: "Usuarios",
    description: "Administracion de usuarios del sistema.",
    table: "usuarios",
    id: "id_usuario",
    fields: [
        { name: "nombre", label: "Nombre", required: true },
        { name: "apellido", label: "Apellido", required: true },
        { name: "identidad", label: "Identidad", required: true },
        { name: "telefono", label: "Teléfono", required: true },
        { name: "correo", label: "Correo", type: "email" },
        { name: "direccion", label: "Dirección", wide: true, required: true },
        { name: "nombre_usuario", label: "Nombre de Usuario", required: true },
        { name: "contrasena", label: "Contraseña", type: "password", required: true },
        { name: "rol", label: "Rol", type: "select", options: ["Administrador", "Cajero", "Farmacéutico"], required: true },
        { name: "estado", label: "Estado", type: "select", options: ["Activo", "Inactivo"] }
    ]
};
