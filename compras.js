module.exports = {
    title: "Compras",
    description: "Registro de compras de medicamentos a laboratorios.",
    table: "compras",
    id: "id_compra",
    fields: [
        {
            name: "numero_factura",
            label: "Número de factura",
            autoInvoice: true,
            hidden: true,
            required: true
        },
        {
            name: "id_usuario",
            label: "ID del usuario",
            type: "number",
            min: 1,
            currentUser: true,
            readOnly: true,
            required: true
        },
        {
            name: "id_distribuidor",
            label: "Laboratorio o proveedor",
            type: "distributor-name",
            displayName: "nombre_distribuidor",
            showInTable: true,
            required: true
        },
        {
            name: "telefono_distribuidor",
            label: "Teléfono del distribuidor",
            virtual: true,
            required: true
        },
        {
            name: "correo_distribuidor",
            label: "Correo del distribuidor",
            type: "email",
            virtual: true,
            required: true
        },
        {
            name: "id_medicamento",
            label: "Descripción de medicamentos comprados",
            type: "textarea",
            required: true
        },
        {
            name: "fecha_compra",
            label: "Fecha de compra",
            type: "date",
            required: true
        },
        {
            name: "cantidad",
            label: "Cantidad",
            type: "number",
            min: 1,
            required: true
        },
        {
            name: "precio_unitario",
            label: "Precio unitario",
            type: "number",
            min: 0,
            step: "0.01",
            required: true
        },
        {
            name: "total",
            label: "Total",
            type: "number",
            min: 0,
            step: "0.01",
            automaticTotal: true,
            readOnly: true,
            required: true
        },
        {
            name: "metodo_pago",
            label: "Método de pago",
            type: "select",
            options: ["Efectivo", "Tarjeta", "Transferencia", "Credito"],
            required: true
        },
        {
            name: "estado",
            label: "Estado",
            type: "select",
            options: ["Pendiente", "Recibida", "Cancelada"]
        },
        { name: "numero_lote_compra", label: "Número de lote", required: true, virtual: true, lotField: true },
        { name: "fecha_fabricacion_lote", label: "Fecha de fabricación", type: "date", required: true, virtual: true, lotField: true },
        { name: "fecha_vencimiento_lote", label: "Fecha de vencimiento", type: "date", required: true, virtual: true, lotField: true }
    ]
};