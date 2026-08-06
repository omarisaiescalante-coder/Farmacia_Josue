// Configuración declarativa del formulario y tabla de usuarios.
module.exports = {
    title: "Usuarios",
    description: "Administración de usuarios del sistema.",
    table: "usuarios",
    id: "id_usuario",
    fields: [
        { name: "nombre", label: "Nombre", required: true },
        { name: "apellido", label: "Apellido", required: true },
        { name: "identidad", label: "Identidad", exactLength: 15, format: "identity", placeholder: "Ej. 0706-2000-04500", required: true },
        { name: "telefono", label: "Teléfono", exactLength: 9, format: "phone", placeholder: "Ej. 9999-9999", required: true },
        { name: "correo", label: "Correo", type: "email" },
        { name: "direccion", label: "Dirección", wide: true, required: true },
        { name: "nombre_usuario", label: "Nombre de Usuario", required: true },
        {
            name: "contrasena",
            label: "Contraseña",
            type: "password",
            showPassword: true,
            minlength: 8,
            passwordRule: true,
            required: true
        },
        { name: "rol", label: "Rol", type: "select", options: ["Administrador", "Cajero"], required: true },
        { name: "estado", label: "Estado", type: "select", options: ["Activo", "Inactivo"], defaultValue: "Activo" }
    ] 
};
