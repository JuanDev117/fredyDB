/**
 * Servidor Principal AcademicOS
 * Maneja la lógica de negocio, conexión a Oracle DB y servicios API REST.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Configuración del Driver de Oracle para soporte de versiones específicas (Modo Thick)
try {
    oracledb.initOracleClient({ libDir: 'C:\\instantClientOracle\\instantclient_23_0' });
    console.log('Modo Thick activado con Instant Client.');
} catch (err) {
    console.error('Error al iniciar Modo Thick:', err);
}

// Configuración global de comportamiento para oracledb
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

// Middlewares
// cors: Permite peticiones desde el frontend (habitualmente en otro puerto/dominio)
app.use(cors());
app.use(express.json());

// Configuración de Multer para Carga Masiva
const upload = multer({ dest: 'uploads/' });

// Configuración de la conexión
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECTION_STRING
};

/**
 * Inicializa el Pool de conexiones de Oracle.
 * Es más eficiente que abrir/cerrar conexiones individuales en cada petición.
 */
async function initialize() {
    try {
        await oracledb.createPool(dbConfig);
        console.log('Modo Thick activado con Instant Client.');
    } catch (err) {
        console.error(' Error Oracle:', err);
        process.exit(1);
    }
}

// ==========================================
// MÓDULO DATOS: CRUD TERCEROS (Procedimientos)
// ==========================================

// Obtener todos los registros de la tabla TERCEROS
app.get('/api/terceros', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute(`SELECT TERC_ID as ID, TERC_NOMBRES as NOMBRES, TERC_APELLIDOS as APELLIDOS, TERC_CORREO as CORREO, TERC_TIPO as TIPO FROM TERCEROS`);
        res.json(result.rows);
    } catch (err) {
        console.error(' Error en GET /api/terceros:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// Insertar un nuevo registro en TERCEROS
app.post('/api/terceros', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const { id, nombres, apellidos, correo, tipo } = req.body;
        await connection.execute(
            `INSERT INTO TERCEROS (TERC_ID, TERC_NOMBRES, TERC_APELLIDOS, TERC_CORREO, TERC_TIPO) VALUES (:id, :nombres, :apellidos, :correo, :tipo)`,
            [id, nombres, apellidos, correo, tipo]
        );
        res.status(201).json({ message: 'Tercero creado' });
    } catch (err) {
        console.error('Error en POST /api/terceros:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// Actualizar datos de un tercero existente mediante su ID
app.put('/api/terceros/:id', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const { id } = req.params;
        const { nombres, apellidos, correo, tipo } = req.body;
        await connection.execute(
            `UPDATE TERCEROS SET TERC_NOMBRES = :nombres, TERC_APELLIDOS = :apellidos, TERC_CORREO = :correo, TERC_TIPO = :tipo WHERE TERC_ID = :id`,
            [nombres, apellidos, correo, tipo, id]
        );
        res.json({ message: 'Tercero actualizado' });
    } catch (err) {
        console.error(' Error en PUT /api/terceros:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// Eliminar un registro de TERCEROS por su ID
app.delete('/api/terceros/:id', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const { id } = req.params;
        await connection.execute(
            `DELETE FROM TERCEROS WHERE TERC_ID = :id`,
            [id]
        );
        res.json({ message: 'Tercero eliminado' });
    } catch (err) {
        console.error(' Error en DELETE /api/terceros:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// ==========================================
// ENDPOINTS DE APOYO (Estadísticas y Listas)
// ==========================================

// Obtener métricas rápidas (conteos) para los indicadores del dashboard
app.get('/api/stats', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const terc = await connection.execute('SELECT COUNT(*) as TOTAL FROM TERCEROS');
        const prog = await connection.execute('SELECT COUNT(*) as TOTAL FROM PROGRAMAS');
        const asig = await connection.execute('SELECT COUNT(*) as TOTAL FROM ASIGNATURAS');
        const pens = await connection.execute('SELECT COUNT(*) as TOTAL FROM PENSUMS');

        res.json({
            terceros: terc.rows[0].TOTAL,
            programas: prog.rows[0].TOTAL,
            asignaturas: asig.rows[0].TOTAL,
            pensums: pens.rows[0].TOTAL
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// Obtener Lista de Programas (Para el select del formulario)
app.get('/api/programas', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute('SELECT PROG_ID as ID, PROG_PROGRAMA as NOMBRE FROM PROGRAMAS');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// ==========================================
// MÓDULO HERRAMIENTAS: IMPORTAR / EXPORTAR
// ==========================================

// Endpoint de importación masiva (Tabla ASIGNATURAS)
app.post('/api/herramientas/importar', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No se subió ningún archivo' });
    
    const results = [];
    // Usamos csv-parser con soporte para diferentes delimitadores
    fs.createReadStream(req.file.path)
        .pipe(csv({ separator: ',' })) // Por defecto comas, pero puedes cambiarlo a ';' si es necesario
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                let count = 0;
                
                for (const row of results) {
                    // Validamos que los datos necesarios existan en el CSV
                    if (!row.id || !row.nombre) continue;
                    
                    // Inserción fila por fila
                    await connection.execute(
                        `INSERT INTO ASIGNATURAS (ASIG_ID, ASIG_ASIGNATURA, ASIG_CREDITOS, ASIG_CODIGO) 
                         VALUES (:id, :nomb, :cred, :cod)`,
                        {
                            id: parseInt(row.id),
                            // Mapeo de campos del CSV a columnas de DB
                            nomb: row.nombre,
                            cred: parseInt(row.creditos || 0),
                            cod: row.codigo || 'SIN-COD'
                        }
                    );
                    count++;
                }
                await connection.commit(); // Confirmamos los cambios de forma masiva
                res.json({ message: `✅ Importación exitosa: ${count} asignaturas añadidas.` });
            } catch (err) {
                console.error(' Error en importación:', err);
                res.status(500).json({ error: 'Error en la base de datos: ' + err.message });
            } finally {
                if (connection) await connection.close();
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); // Limpiar archivo temporal
            }
        });
});

// Exportar el catálogo de asignaturas a un formato CSV descargable
app.get('/api/herramientas/exportar', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute('SELECT * FROM ASIGNATURAS');
        const csvData = result.rows.map(row => Object.values(row).join(',')).join('\n');
        res.header('Content-Type', 'text/csv');
        res.attachment('asignaturas_export.csv');
        res.send(csvData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// ==========================================
// MÓDULO REPORTES: PROMEDIOS (Tabla HISTORIAS)
// ==========================================
// Calcula el promedio de notas de un estudiante (Tercero)
app.get('/api/reportes/promedio/:estudianteId', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const { estudianteId } = req.params;
        
        // Consulta basada en el diagrama ERD
        const result = await connection.execute(
            `SELECT AVG(HIST_NOTA) as PROMEDIO FROM HISTORIAS WHERE TERC_ID = :id`,
            [estudianteId]
        );
        
        const promedio = result.rows[0].PROMEDIO || 0;
        res.json({ 
            id: estudianteId, 
            promedio: parseFloat(promedio).toFixed(2),
            fecha: new Date().toLocaleDateString()
        });
    } catch (err) {
        console.error(' Error en Reportes:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// ==========================================
// MÓDULO PROCESOS: AUDITORÍA Y PENSUM
// ==========================================
// Recupera logs de auditoría registrados en la base de datos
app.get('/api/procesos/auditoria', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute('SELECT * FROM PISTAS_AUDITORIA ORDER BY FECHA DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// Asocia una asignatura a un programa académico (Tabla PENSUMS)
app.post('/api/procesos/asignar-pensum', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const { programaId, asignaturaId } = req.body;
        await connection.execute(
            `INSERT INTO PENSUMS (PROGRAMA_ID, ASIGNATURA_ID) VALUES (:prog, :asig)`,
            [programaId, asignaturaId]
        );
        res.json({ message: 'Pensum asignado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// Iniciar Servidor
initialize().then(() => {
    app.listen(port, () => console.log(` Backend AcademicOS en puerto ${port}`));
});

process.on('SIGINT', async () => {
    try { await oracledb.getPool().close(0); process.exit(0); } catch (e) { process.exit(1); }
});
