// Configuración de la vista de consulta de facturas.
module.exports = {
    title: "Facturas",
    description: "Consulta de facturas emitidas a clientes.",
    table: "facturas",
    id: "referencia",
    readOnly: true,
    fields: [
        { name: "numero_factura", label: "Número de factura" },
        { name: "fecha", label: "Fecha" },
        { name: "responsable", label: "Responsable" },
        { name: "tercero", label: "Cliente" },
        { name: "subtotal", label: "Subtotal" },
        { name: "descuento", label: "Descuento automático" },
        { name: "impuesto", label: "Impuesto" },
        { name: "total", label: "Total" },
        { name: "metodo_pago", label: "Método de pago" },
        { name: "monto_recibido", label: "Monto recibido" },
        { name: "cambio", label: "Cambio" },
        { name: "puntos_generados", label: "Puntos generados" },
        { name: "puntos_utilizados", label: "Puntos utilizados" },
        { name: "estado", label: "Estado" }
    ] 
};
