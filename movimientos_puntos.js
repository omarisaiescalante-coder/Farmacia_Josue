module.exports = {
    title: "Movimientos de puntos",
    description: "Historial de acumulacion, canje y ajustes de puntos.",
    table: "movimientos_puntos",
    id: "id_movimiento",
    fields: [
        { name: "id_cliente", label: "ID Cliente", type: "number", min: 1, required: true },
        { name: "tipo_movimiento", label: "Tipo Movimiento", type: "select", options: ["Acumulacion", "Canje", "Ajuste"], required: true },
        { name: "cantidad_puntos", label: "Cantidad Puntos", type: "number", min: 0, required: true },
        { name: "puntos_anteriores", label: "Puntos Anteriores", type: "number", min: 0, required: true },
        { name: "puntos_nuevos", label: "Puntos Nuevos", type: "number", min: 0, required: true },
        { name: "descripcion", label: "Descripción", type: "textarea", full: true }
    ]
};
