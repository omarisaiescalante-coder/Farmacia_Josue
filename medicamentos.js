module.exports = {
    title: "Medicamentos",
    description: "Inventario y datos comerciales de medicamentos.",
    table: "medicamentos",
    id: "id_medicamento",
    fields: [
        { name: "codigo", label: "Código", required: true },
        { name: "nombre", label: "Nombre", required: true },
        { name: "descripcion", label: "Descripción", type: "textarea", full: true },
        { name: "categoria", label: "Categoría" },
        { name: "presentacion", label: "Presentación", wide: true },
        { name: "precio_compra", label: "Precio Compra", type: "number", min: 0, step: "0.01", required: true },
        { name: "precio_venta", label: "Precio Venta", type: "number", min: 0, step: "0.01", required: true },
        { name: "stock_total", label: "Stock Total", type: "number", min: 0, readOnly: true },
        { name: "stock_minimo", label: "Stock Mínimo", type: "number", min: 0 },
        { name: "restriccion", label: "Restricción", type: "select", options: ["Sin Receta Medica", "Con Receta Medica"], required: true },
        { name: "laboratorio", label: "Laboratorio" },
        { name: "forma_venta", label: "Forma de Venta", type: "select", options: ["Caja", "Unidad", "Frasco", "Blister", "Sobre", "Ampolla"], required: true },
        { name: "presentacion_alternativa", label: "Presentación alternativa", virtual: true },
        { name: "precio_presentacion_alternativa", label: "Precio de presentación alternativa", type: "number", min: 0, step: "0.01", virtual: true },
        { name: "estado", label: "Estado", type: "select", options: ["Disponible", "Agotado", "Inactivo"] },
        { name: "numero_lote_registro", label: "Número de lote", required: true, virtual: true, lotField: true },
        { name: "cantidad_lote_registro", label: "Cantidad recibida", type: "number", min: 1, required: true, virtual: true, lotField: true },
        { name: "fecha_fabricacion_lote", label: "Fecha de fabricación", type: "date", required: true, virtual: true, lotField: true },
        { name: "fecha_vencimiento_lote", label: "Fecha de vencimiento", type: "date", required: true, virtual: true, lotField: true }
    ]
};
