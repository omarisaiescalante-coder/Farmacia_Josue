// Configuración de los campos para el ingreso de lotes e inventario.
module.exports = {
    title: "Lotes",
    description: "Control de lotes de medicamentos.",
    table: "lote",
    id: "id_lote",
    fields: [
        {
            name: "id_medicamento",
            label: "Nombre Medicamento",
            type: "medicine-name",
            displayName: "nombre_medicamento",
            showInTable: true,
            required: true
        },
        {
            name: "numero_lote",
            label: "Número Lote",
            readOnly: true,
            required: true
        },
        {
            name: "stock_total",
            label: "Stock Total",
            type: "number",
            virtual: true,
            showInTable: true,
            readOnly: true
        }, 
        {
            name: "laboratorio",
            label: "Laboratorio",
            virtual: true,
            readOnly: true
        },
        {
            name: "formas_venta",
            label: "Formas de Venta y Precios",
            virtual: true,
            full: true
        },
        {
            name: "cantidad_inicial",
            label: "Cantidad a Ingresar",
            type: "number",
            min: 1,
            required: true
        },
        {
            name: "fecha_fabricacion",
            label: "Fecha Fabricación",
            type: "date",
            required: true
        },
        {
            name: "fecha_vencimiento",
            label: "Fecha Vencimiento",
            type: "date",
            required: true
        },
        {
            name: "precio_compra",
            label: "Precio Compra",
            type: "number",
            min: 0,
            step: "0.01",
            required: true
        },
        {
            name: "precio_compra_total",
            label: "Precio de Compra Total",
            type: "number",
            virtual: true,
            showInTable: true,
            readOnly: true
        }
    ]
};
