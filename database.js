const mysql = require('mysql2');
//Importamos la libreria mysql2 para concetar a MySQL

const connection = mysql.createPool({         //creamos conexion a la base de datos
    host: 'localhost',
    // servidor donde se encuentra la base de datos
    user: "root",
    //usuario de MySQL
    password: "1234",
    //contraseña de MySQL
    database: "Farmacia_bd",
    //nombre de la base de datos
    waitForConnections: true,
    //esperar a que se establezca la conexion antes de ejecutar consultas
    connectionLimit: 10,
    queueLimit: 0
});

connection.getConnection(function(error, connection) {
    //abrimos la conexion a la base de datos
    if (error) {
        console.log("Error al conectar MySQL: ", error);
        return;
    }
    console.log("Conexión exitosa");
    connection.release();
});

module.exports = connection;
//Exportar la conexión para poder usarla en otros archivos

