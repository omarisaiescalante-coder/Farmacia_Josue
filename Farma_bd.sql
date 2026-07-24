CREATE DATABASE Farmacia_bd;

use Farmacia_bd;

-- ----------------------------------------------------------------------

create table clientes(

id_cliente INT AUTO_INCREMENT PRIMARY KEY,
nombre VARCHAR(100) NOT NULL,
apellido VARCHAR(100) NOT NULL,
identidad VARCHAR(20) NOT NULL UNIQUE,
telefono VARCHAR(20),
correo VARCHAR(150),
direccion VARCHAR(255),
fecha_nacimiento DATE,
puntos_acumulados INT DEFAULT 0,
estado ENUM('Activo','Inactivo') DEFAULT 'Activo',
fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- ----------------------------------------------------------------------

CREATE TABLE usuarios (

id_usuario INT AUTO_INCREMENT PRIMARY KEY,
nombre VARCHAR(100) NOT NULL,
apellido VARCHAR(100) NOT NULL,
identidad VARCHAR(20) UNIQUE,
telefono VARCHAR(20),
correo VARCHAR(150) UNIQUE,
direccion VARCHAR(255),
nombre_usuario VARCHAR(50) UNIQUE NOT NULL,
contrasena VARCHAR(255) NOT NULL,
rol ENUM('Administrador','Cajero') NOT NULL,
estado ENUM('Activo','Inactivo') DEFAULT 'Activo',
fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- ----------------------------------------------------------------------


CREATE TABLE Movimientos_Puntos (

id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
id_cliente INT NOT NULL,
tipo_movimiento ENUM('Acumulacion','Canje','Ajuste') NOT NULL,
cantidad_puntos INT NOT NULL,
puntos_anteriores INT NOT NULL,
puntos_nuevos INT NOT NULL,
descripcion VARCHAR(255),
fecha_movimiento DATETIME DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)

);

-- --------------------------------------------------------------------

CREATE TABLE medicamentos (

id_medicamento INT AUTO_INCREMENT PRIMARY KEY,
codigo VARCHAR(20) UNIQUE NOT NULL,
nombre VARCHAR(150) UNIQUE NOT NULL,
descripcion VARCHAR(255),
categoria VARCHAR(100),
presentacion VARCHAR(150),
precio_compra DECIMAL(10,2) NOT NULL,
precio_venta DECIMAL(10,2) NOT NULL,
stock_total INT DEFAULT 0,
stock_minimo INT DEFAULT 5,
restriccion ENUM('Sin Receta Medica','Con Receta Medica') NOT NULL,
laboratorio VARCHAR(150),
forma_venta ENUM('Caja','Unidad','Frasco','Blister','Sobre','Ampolla') NOT NULL,
estado ENUM('Disponible','Agotado','Inactivo') DEFAULT 'Disponible',
fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
        
);

-- --------------------------------------------------------------------

CREATE TABLE Medicamento_presentaciones (

id_presentacion INT AUTO_INCREMENT PRIMARY KEY,
id_medicamento INT NOT NULL,
nombre_presentacion VARCHAR(150) NOT NULL,
precio_venta DECIMAL(10,2) NOT NULL,
estado ENUM('Activa','Inactiva') DEFAULT 'Activa',
UNIQUE (id_medicamento, nombre_presentacion),
FOREIGN KEY (id_medicamento) REFERENCES medicamentos(id_medicamento)

);

-- --------------------------------------------------------------------

CREATE TABLE Lote (

id_lote INT AUTO_INCREMENT PRIMARY KEY,
id_medicamento INT NOT NULL,
numero_lote VARCHAR(50) UNIQUE NOT NULL,
cantidad_inicial INT NOT NULL,
cantidad_disponible INT NOT NULL,
fecha_fabricacion DATE,
fecha_vencimiento DATE NOT NULL,
precio_compra DECIMAL(10,2),
estado ENUM('Disponible','Agotado','Vencido','Retirado') DEFAULT 'Disponible',
fecha_ingreso DATETIME DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (id_medicamento) REFERENCES medicamentos(id_medicamento)

);
-- -------------------------------------------------------------------

CREATE TABLE Distribuidores (

id_distribuidor INT AUTO_INCREMENT PRIMARY KEY,
nombre VARCHAR(150) UNIQUE NOT NULL,
telefono VARCHAR(20),
correo VARCHAR(150),
direccion VARCHAR(255),
estado ENUM('Activo','Inactivo') DEFAULT 'Activo',
fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- -------------------------------------------------------------------

CREATE TABLE Compras (

id_compra INT AUTO_INCREMENT PRIMARY KEY,
numero_factura VARCHAR(50) UNIQUE NOT NULL,
id_usuario INT NOT NULL,
id_medicamento INT NOT NULL,
id_distribuidor INT NOT NULL,
fecha_compra DATE NOT NULL,
cantidad INT NOT NULL,
precio_unitario DECIMAL(10,2) NOT NULL,
total DECIMAL(10,2) NOT NULL,
metodo_pago ENUM('Efectivo','Tarjeta','Transferencia','Credito') NOT NULL,
estado ENUM('Pendiente','Recibida','Cancelada') DEFAULT 'Pendiente',
fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
FOREIGN KEY (id_medicamento) REFERENCES medicamentos(id_medicamento),
FOREIGN KEY (id_distribuidor) REFERENCES distribuidores(id_distribuidor)

);

-- -------------------------------------------------------------------

ALTER TABLE Lote
ADD COLUMN id_compra INT NULL,
ADD FOREIGN KEY (id_compra) REFERENCES compras(id_compra);

-- -------------------------------------------------------------------

CREATE TABLE Ventas (

id_venta INT AUTO_INCREMENT PRIMARY KEY,
numero_factura VARCHAR(30) UNIQUE NOT NULL,
id_cliente INT,
id_usuario INT NOT NULL,
fecha_venta DATETIME DEFAULT CURRENT_TIMESTAMP,
subtotal DECIMAL(10,2) NOT NULL,
descuento DECIMAL(10,2) DEFAULT 0.00,
impuesto DECIMAL(10,2) DEFAULT 0.00,
total DECIMAL(10,2) NOT NULL,
metodo_pago ENUM('Efectivo','Tarjeta','Transferencia','Mixto') NOT NULL,
monto_recibido DECIMAL(10,2),
cambio DECIMAL(10,2) DEFAULT 0.00,
puntos_generados INT DEFAULT 0,
puntos_utilizados INT DEFAULT 0,
estado ENUM('Completada','Anulada') DEFAULT 'Completada',
FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)

);

-- --------------------------------------------------------------------

CREATE TABLE Detalles_venta (

id_detalle_venta INT AUTO_INCREMENT PRIMARY KEY,
id_venta INT NOT NULL,
id_medicamento INT NOT NULL,
id_presentacion INT,
presentacion VARCHAR(150) NOT NULL,
cantidad INT NOT NULL,
precio_unitario DECIMAL(10,2) NOT NULL,
descuento DECIMAL(10,2) DEFAULT 0.00,
subtotal DECIMAL(10,2) NOT NULL,
FOREIGN KEY (id_venta) REFERENCES ventas(id_venta),
FOREIGN KEY (id_medicamento) REFERENCES medicamentos(id_medicamento),
FOREIGN KEY (id_presentacion) REFERENCES medicamento_presentaciones(id_presentacion)

);


USE Farmacia_bd;

-- =========================================================
-- 					 CLIENTES
-- =========================================================

INSERT INTO clientes
(id_cliente, nombre, apellido, identidad, telefono, correo, direccion, fecha_nacimiento, puntos_acumulados, estado)
VALUES
(1, 'Carlos', 'Martinez', '0801-1995-00123', '9991-2345', 'carlos.martinez@gmail.com', 'Barrio El Centro, Danli', '1995-04-12', 25, 'Activo'),
(2, 'Maria', 'Lopez', '0703-1998-00456', '9876-5432', 'maria.lopez@gmail.com', 'Colonia Las Acacias, Danli', '1998-08-25', 40, 'Activo'),
(3, 'Jose', 'Hernandez', '0708-1989-00789', '9755-1122', 'jose.hernandez@gmail.com', 'Barrio Abajo, Teupasenti', '1989-11-03', 15, 'Activo'),
(4, 'Ana', 'Rodriguez', '0801-2000-00321', '9644-7788', 'ana.rodriguez@gmail.com', 'Colonia Kennedy, Tegucigalpa', '2000-02-17', 10, 'Activo'),
(5, 'Luis', 'Gomez', '0703-1992-00654', '9533-9900', 'luis.gomez@gmail.com', 'Barrio La Reforma, Danli', '1992-06-30', 0, 'Inactivo');


-- =========================================================
-- 					 USUARIOS
-- =========================================================

INSERT INTO usuarios
(id_usuario, nombre, apellido, identidad, telefono, correo, direccion, nombre_usuario, contrasena, rol, estado)
VALUES
(1, 'Omar', 'Escalante', '0706-2000-00085', '8886-7344', 'OmarEs@farmacia.com', 'Danli, El Paraiso', 'Omar_Adm', 'Amd1234', 'Administrador', 'Activo'),
(2, 'Maria', 'Rivas', '0703-1999-01119', '9888-2222', 'Maria@farmacia.com', 'Barrio El Centro, Danli', 'Maria_Adm', 'Perropulgoso12_', 'Administrador', 'Activo'),
(3, 'Loany', 'Matamoros', '0703-1996-00333', '9777-3333', 'Loany@farmacia.com', 'Colonia Las Colinas, Danli', 'Loany_Adm', 'Ositoloco1@', 'Administrador', 'Activo'),
(4, 'Maryuri', 'Segura', '0703-2001-00444', '9666-4444', 'Maryu@farmacia.com', 'Barrio Abajo, Danli', 'Maryuri_Adm', 'Jefa2026-@', 'Administrador', 'Activo'),
(5, 'Fabricio', 'Torrez', '0703-1994-00555', '9555-5555', 'Fabricio@farmacia.com', 'Teupasenti, El Paraiso', 'Fabricio_Adm', 'Nohay@_7.', 'Administrador', 'Activo'),
(6, 'Josue', 'Rivera', '0703-2002-00666', '9444-6611', 'Josue@farmacia.com', 'Barrio El Centro, Danli', 'Josue_Caj', 'Cajero2026@', 'Cajero', 'Activo');


-- =========================================================
-- 					MEDICAMENTOS
-- =========================================================

INSERT INTO medicamentos
(id_medicamento, codigo, nombre, descripcion, categoria, presentacion, precio_compra, precio_venta, stock_total, stock_minimo, restriccion, laboratorio, forma_venta, estado)
VALUES
(1, 'MED001', 'Acetaminofen', 'Medicamento para aliviar el dolor y reducir la fiebre', 'Analgesico', 'Caja de 20 tabletas de 500 mg', 35.50, 50.00, 100, 10, 'Sin Receta Medica', 'Laboratorios Finlay', 'Caja', 'Disponible'),
(2, 'MED002', 'Ibuprofeno', 'Antiinflamatorio para aliviar dolor, fiebre e inflamacion', 'Antiinflamatorio', 'Caja de 20 tabletas de 400 mg', 48.75, 65.00, 80, 10, 'Sin Receta Medica', 'Bayer', 'Caja', 'Disponible'),
(3, 'MED003', 'Amoxicilina', 'Antibiotico utilizado para tratar infecciones bacterianas', 'Antibiotico', 'Caja de 21 capsulas de 500 mg', 95.00, 125.00, 60, 8, 'Con Receta Medica', 'MK', 'Caja', 'Disponible'),
(4, 'MED004', 'Loratadina', 'Antihistaminico para aliviar sintomas de alergia', 'Antialergico', 'Caja de 10 tabletas de 10 mg', 28.00, 42.00, 75, 10, 'Sin Receta Medica', 'Calox', 'Caja', 'Disponible'),
(5, 'MED005', 'Omeprazol', 'Medicamento para reducir la produccion de acido estomacal', 'Gastrointestinal', 'Caja de 30 capsulas de 20 mg', 70.00, 95.00, 50, 8, 'Sin Receta Medica', 'MK', 'Caja', 'Disponible'),
(6, 'MED006', 'Azitromicina', 'Antibiotico para infecciones respiratorias y bacterianas', 'Antibiotico', 'Caja de 3 tabletas de 500 mg', 115.00, 150.00, 35, 5, 'Con Receta Medica', 'Genfar', 'Caja', 'Disponible'),
(7, 'MED007', 'Diclofenaco', 'Antiinflamatorio para dolores musculares y articulares', 'Antiinflamatorio', 'Caja de 20 tabletas de 50 mg', 40.00, 58.00, 65, 10, 'Sin Receta Medica', 'Bayer', 'Caja', 'Disponible'),
(8, 'MED008', 'Metformina', 'Medicamento utilizado para controlar la diabetes tipo 2', 'Antidiabetico', 'Caja de 30 tabletas de 850 mg', 75.00, 105.00, 45, 8, 'Con Receta Medica', 'La Sante', 'Caja', 'Disponible'),
(9, 'MED009', 'Losartan', 'Medicamento utilizado para controlar la presion arterial', 'Antihipertensivo', 'Caja de 30 tabletas de 50 mg', 85.00, 115.00, 55, 8, 'Con Receta Medica', 'MK', 'Caja', 'Disponible'),
(10, 'MED010', 'Salbutamol', 'Medicamento broncodilatador para aliviar problemas respiratorios', 'Respiratorio', 'Frasco inhalador de 100 dosis', 125.00, 165.00, 30, 5, 'Con Receta Medica', 'GlaxoSmithKline', 'Frasco', 'Disponible'),
(11, 'MED011', 'Cetirizina', 'Antihistaminico utilizado para tratar alergias', 'Antialergico', 'Caja de 10 tabletas de 10 mg', 32.00, 48.00, 70, 10, 'Sin Receta Medica', 'Genfar', 'Caja', 'Disponible'),
(12, 'MED012', 'Naproxeno', 'Antiinflamatorio utilizado para dolor muscular y menstrual', 'Antiinflamatorio', 'Caja de 20 tabletas de 500 mg', 55.00, 75.00, 65, 10, 'Sin Receta Medica', 'Bayer', 'Caja', 'Disponible'),
(13, 'MED013', 'Ciprofloxacina', 'Antibiotico utilizado para tratar infecciones bacterianas', 'Antibiotico', 'Caja de 10 tabletas de 500 mg', 90.00, 120.00, 40, 6, 'Con Receta Medica', 'Calox', 'Caja', 'Disponible'),
(14, 'MED014', 'Clotrimazol', 'Medicamento antimicotico para infecciones causadas por hongos', 'Antimicotico', 'Tubo de crema de 20 gramos', 45.00, 65.00, 50, 8, 'Sin Receta Medica', 'MK', 'Unidad', 'Disponible'),
(15, 'MED015', 'Ambroxol', 'Jarabe utilizado para facilitar la expulsion de flemas', 'Expectorante', 'Frasco de 120 ml', 50.00, 70.00, 45, 8, 'Sin Receta Medica', 'Genfar', 'Frasco', 'Disponible'),
(16, 'MED016', 'Enalapril', 'Medicamento utilizado para tratar la hipertension arterial', 'Antihipertensivo', 'Caja de 30 tabletas de 20 mg', 65.00, 90.00, 50, 8, 'Con Receta Medica', 'La Sante', 'Caja', 'Disponible'),
(17, 'MED017', 'Insulina Glargina', 'Insulina de accion prolongada para controlar la glucosa', 'Antidiabetico', 'Frasco de 10 ml', 480.00, 550.00, 20, 5, 'Con Receta Medica', 'Sanofi', 'Frasco', 'Disponible'),
(18, 'MED018', 'Suero Oral', 'Solucion para prevenir y tratar la deshidratacion', 'Hidratacion', 'Sobre para preparar un litro', 8.00, 12.00, 150, 20, 'Sin Receta Medica', 'Laboratorios Finlay', 'Sobre', 'Disponible'),
(19, 'MED019', 'Vitamina C', 'Suplemento utilizado para fortalecer el sistema inmunologico', 'Vitaminas', 'Frasco de 30 tabletas de 500 mg', 55.00, 75.00, 90, 10, 'Sin Receta Medica', 'Centrum', 'Frasco', 'Disponible'),
(20, 'MED020', 'Dexametasona', 'Corticosteroide utilizado para procesos inflamatorios y alergicos', 'Corticosteroide', 'Caja de 10 ampollas de 4 mg', 110.00, 145.00, 0, 5, 'Con Receta Medica', 'Calox', 'Ampolla', 'Agotado');

INSERT INTO Medicamento_presentaciones
(id_medicamento, nombre_presentacion, precio_venta)
SELECT
    id_medicamento,
    CASE
        WHEN LOWER(presentacion) LIKE '%tableta%'
          OR LOWER(presentacion) LIKE '%capsula%'
        THEN 'Caja'
        ELSE forma_venta
    END,
    precio_venta
FROM medicamentos;

INSERT INTO Medicamento_presentaciones
(id_medicamento, nombre_presentacion, precio_venta)
VALUES
(1, 'Unidad', 2.50), (1, 'Blister', 25.00),
(2, 'Unidad', 3.25), (2, 'Blister', 32.50),
(3, 'Unidad', 5.95), (3, 'Blister', 59.52),
(4, 'Unidad', 4.20), (4, 'Blister', 42.00),
(5, 'Unidad', 3.17), (5, 'Blister', 31.67),
(6, 'Unidad', 50.00), (6, 'Blister', 150.00),
(7, 'Unidad', 2.90), (7, 'Blister', 29.00),
(8, 'Unidad', 3.50), (8, 'Blister', 35.00),
(9, 'Unidad', 3.83), (9, 'Blister', 38.33),
(11, 'Unidad', 4.80), (11, 'Blister', 48.00),
(12, 'Unidad', 3.75), (12, 'Blister', 37.50),
(13, 'Unidad', 12.00), (13, 'Blister', 120.00),
(16, 'Unidad', 3.00), (16, 'Blister', 30.00),
(19, 'Unidad', 2.50), (19, 'Blister', 25.00);


-- =========================================================
--       				LOTES
-- =========================================================

INSERT INTO Lote
(id_lote, id_medicamento, numero_lote, cantidad_inicial, cantidad_disponible, fecha_fabricacion, fecha_vencimiento, precio_compra, estado)
VALUES
(1, 1, 'LOT-AC-001', 100, 98, '2026-01-15', '2028-01-15', 35.50, 'Disponible'),
(2, 2, 'LOT-IB-002', 80, 78, '2026-02-10', '2028-02-10', 48.75, 'Disponible'),
(3, 3, 'LOT-AM-003', 60, 59, '2026-03-05', '2027-09-05', 95.00, 'Disponible'),
(4, 4, 'LOT-LO-004', 75, 72, '2026-01-20', '2028-01-20', 28.00, 'Disponible'),
(5, 5, 'LOT-OM-005', 50, 49, '2026-04-12', '2028-04-12', 70.00, 'Disponible'),
(6, 6, 'LOT-AZ-006', 35, 35, '2026-05-01', '2028-05-01', 115.00, 'Disponible'),
(7, 7, 'LOT-DI-007', 65, 65, '2026-05-02', '2028-05-02', 40.00, 'Disponible'),
(8, 8, 'LOT-ME-008', 45, 45, '2026-05-03', '2028-05-03', 75.00, 'Disponible'),
(9, 9, 'LOT-LO-009', 55, 55, '2026-05-04', '2028-05-04', 85.00, 'Disponible'),
(10, 10, 'LOT-SA-010', 30, 30, '2026-05-05', '2028-05-05', 125.00, 'Disponible'),
(11, 11, 'LOT-CE-011', 70, 70, '2026-05-06', '2028-05-06', 32.00, 'Disponible'),
(12, 12, 'LOT-NA-012', 65, 65, '2026-05-07', '2028-05-07', 55.00, 'Disponible'),
(13, 13, 'LOT-CI-013', 40, 40, '2026-05-08', '2028-05-08', 90.00, 'Disponible'),
(14, 14, 'LOT-CL-014', 50, 50, '2026-05-09', '2028-05-09', 45.00, 'Disponible'),
(15, 15, 'LOT-AM-015', 45, 45, '2026-05-10', '2028-05-10', 50.00, 'Disponible'),
(16, 16, 'LOT-EN-016', 50, 50, '2026-05-11', '2028-05-11', 65.00, 'Disponible'),
(17, 17, 'LOT-IN-017', 20, 20, '2026-05-12', '2028-05-12', 480.00, 'Disponible'),
(18, 18, 'LOT-SU-018', 150, 150, '2026-05-13', '2028-05-13', 8.00, 'Disponible'),
(19, 19, 'LOT-VI-019', 90, 90, '2026-05-14', '2028-05-14', 55.00, 'Disponible'),
(20, 20, 'LOT-DE-020', 0, 0, '2026-05-15', '2028-05-15', 110.00, 'Agotado');


-- =========================================================
--                     COMPRAS
-- =========================================================

INSERT INTO Distribuidores
(id_distribuidor, nombre, estado)
VALUES
(1, 'Laboratorios Finlay', 'Activo'),
(2, 'Distribuidora Bayer', 'Activo'),
(3, 'Distribuidora MK', 'Activo'),
(4, 'Farmacéutica Calox', 'Activo');

INSERT INTO Compras
(id_compra, numero_factura, id_usuario, id_medicamento, id_distribuidor, fecha_compra, cantidad, precio_unitario, total, metodo_pago, estado)
VALUES
(1, 'COM-0001', 1, 1, 1, '2026-07-15', 100, 35.50, 3550.00, 'Transferencia', 'Recibida'),
(2, 'COM-0002', 4, 2, 2, '2026-07-16', 80, 48.75, 3900.00, 'Credito', 'Recibida'),
(3, 'COM-0003', 3, 3, 3, '2026-07-18', 60, 95.00, 5700.00, 'Transferencia', 'Pendiente'),
(4, 'COM-0004', 1, 4, 4, '2026-07-20', 75, 28.00, 2100.00, 'Efectivo', 'Recibida');


-- =========================================================
--                     VENTAS
-- =========================================================

INSERT INTO Ventas
(id_venta, numero_factura, id_cliente, id_usuario, fecha_venta, subtotal, descuento, impuesto, total, metodo_pago, monto_recibido, cambio, puntos_generados, puntos_utilizados, estado)
VALUES
(1, 'FAC-0001', 1, 2, '2026-07-10 09:15:00', 100.00, 0.00, 15.00, 115.00, 'Efectivo', 120.00, 5.00, 11, 0, 'Completada'),
(2, 'FAC-0002', 2, 2, '2026-07-10 10:30:00', 130.00, 10.00, 18.00, 138.00, 'Tarjeta', 138.00, 0.00, 13, 5, 'Completada'),
(3, 'FAC-0003', 3, 4, '2026-07-11 11:45:00', 125.00, 0.00, 18.75, 143.75, 'Efectivo', 150.00, 6.25, 14, 0, 'Completada'),
(4, 'FAC-0004', 4, 4, '2026-07-12 14:20:00', 126.00, 6.00, 18.00, 138.00, 'Transferencia', 138.00, 0.00, 13, 10, 'Completada'),
(5, 'FAC-0005', 5, 2, '2026-07-13 16:10:00', 95.00, 0.00, 14.25, 109.25, 'Mixto', 110.00, 0.75, 10, 0, 'Completada');


-- =========================================================
--               DETALLES DE VENTA
-- =========================================================

INSERT INTO Detalles_venta
(id_detalle_venta, id_venta, id_medicamento, id_presentacion, presentacion, cantidad, precio_unitario, descuento, subtotal)
VALUES
(1, 1, 1, 1, 'Caja - Caja de 20 tabletas de 500 mg', 2, 50.00, 0.00, 100.00),
(2, 2, 2, 2, 'Caja - Caja de 20 tabletas de 400 mg', 2, 65.00, 0.00, 130.00),
(3, 3, 3, 3, 'Caja - Caja de 21 capsulas de 500 mg', 1, 125.00, 0.00, 125.00),
(4, 4, 4, 4, 'Caja - Caja de 10 tabletas de 10 mg', 3, 42.00, 0.00, 126.00),
(5, 5, 5, 5, 'Caja - Caja de 30 capsulas de 20 mg', 1, 95.00, 0.00, 95.00);


-- =========================================================
--              MOVIMIENTOS DE PUNTOS
-- =========================================================

INSERT INTO Movimientos_Puntos
(id_movimiento, id_cliente, tipo_movimiento, cantidad_puntos, puntos_anteriores, puntos_nuevos, descripcion, fecha_movimiento)
VALUES
(1, 1, 'Acumulacion', 11, 14, 25, 'Puntos obtenidos por la compra FAC-0001', '2026-07-10 09:16:00'),
(2, 2, 'Canje', 5, 32, 27, 'Puntos utilizados como descuento en la compra FAC-0002', '2026-07-10 10:31:00'),
(3, 2, 'Acumulacion', 13, 27, 40, 'Puntos obtenidos por la compra FAC-0002', '2026-07-10 10:32:00'),
(4, 3, 'Acumulacion', 14, 1, 15, 'Puntos obtenidos por la compra FAC-0003', '2026-07-11 11:46:00'),
(5, 4, 'Acumulacion', 13, 7, 20, 'Puntos obtenidos por la compra FAC-0004', '2026-07-12 14:21:00');
