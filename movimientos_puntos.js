module.exports = {
    title: "Movimientos de puntos",
    description: "Historial de acumulacion, canje y ajustes de puntos.",
    table: "movimientos_puntos",
    id: "id_movimiento",
    fields: [
        { name: "id_cliente", label: "ID cliente", type: "number", required: true },
        { name: "id_venta", label: "ID venta", type: "number" },
        { name: "tipo_movimiento", label: "Tipo movimiento", type: "select", options: ["Acumulacion", "Canje", "Ajuste"], required: true },
        { name: "cantidad_puntos", label: "Cantidad puntos", type: "number", required: true },
        { name: "puntos_anteriores", label: "Puntos anteriores", type: "number", required: true },
        { name: "puntos_nuevos", label: "Puntos nuevos", type: "number", required: true },
        { name: "descripcion", label: "Descripcion", type: "textarea", full: true }
    ]
};
