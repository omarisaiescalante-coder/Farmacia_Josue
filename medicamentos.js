module.exports = {
    title: "Medicamentos",
    description: "Inventario y datos comerciales de medicamentos.",
    table: "medicamentos",
    id: "id_medicamento",
    fields: [
        { name: "codigo", label: "Codigo", required: true },
        { name: "nombre", label: "Nombre", required: true },
        { name: "descripcion", label: "Descripcion", type: "textarea", full: true },
        { name: "categoria", label: "Categoria" },
        { name: "presentacion", label: "Presentacion", wide: true },
        { name: "precio_compra", label: "Precio compra", type: "number", step: "0.01", required: true },
        { name: "precio_venta", label: "Precio venta", type: "number", step: "0.01", required: true },
        { name: "stock_total", label: "Stock total", type: "number" },
        { name: "stock_minimo", label: "Stock minimo", type: "number" },
        { name: "restriccion", label: "Restriccion", type: "select", options: ["Sin Receta Medica", "Con Receta Medica"], required: true },
        { name: "laboratorio", label: "Laboratorio" },
        { name: "forma_venta", label: "Forma venta", type: "select", options: ["Caja", "Unidad", "Frasco", "Blister", "Sobre", "Ampolla"], required: true },
        { name: "estado", label: "Estado", type: "select", options: ["Disponible", "Agotado", "Inactivo"] }
    ]
};
