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

const requiredTerceroFields = [
    'tipo_doc',
    'nro_doc',
    'genero',
    'nombres',
    'apellidos',
    'direc',
    'correo',
    'movil',
    'tipo'
];

function getMissingTerceroFields(body) {
    return requiredTerceroFields.filter((field) => !String(body[field] || '').trim());
}

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
        const missingFields = getMissingTerceroFields(req.body);
        if (missingFields.length) {
            return res.status(400).json({
                error: 'Faltan campos obligatorios',
                fields: missingFields
            });
        }

        connection = await oracledb.getConnection();
        const { tipo_doc, nro_doc, genero, nombres, apellidos, direc, correo, movil, tipo } = req.body;
        await connection.execute(
            `BEGIN 
                SP_ING_TERCEROS(
                    :tipo_doc,
                    :nro_doc,
                    :genero,
                    :nombres,
                    :apellidos,
                    :direc,
                    :correo,
                    :movil,
                    :tipo
                ); 
             END;`,
            {
                tipo_doc,
                nro_doc,
                genero,
                nombres,
                apellidos,
                direc,
                correo,
                movil,
                tipo
            }
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
        await connection.execute(//se debe llamar la instruccion y enviar los parametros 
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
        const result = await connection.execute('SELECT PROG_ID, PROG_PROGRAMA FROM PROGRAMAS ORDER BY PROG_PROGRAMA');
        res.json(result.rows);
    } catch (err) {
        console.error('Error en GET /api/programas:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// ==========================================
// MODULO PROCESOS: ASIGNAR PENSUM A ESTUDIANTE
// ==========================================

// Obtener estudiantes registrados en TERCEROS
app.get('/api/estudiantes', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute(`
            SELECT TERC_ID, TERC_NOMBRES, TERC_APELLIDOS
            FROM TERCEROS
            WHERE TERC_TIPO = 0
            ORDER BY TERC_APELLIDOS, TERC_NOMBRES
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error en GET /api/estudiantes:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// Obtener pensums asociados a un programa
app.get('/api/pensums/:prog_id', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const { prog_id } = req.params;
        const result = await connection.execute(
            `SELECT *
             FROM PENSUMS
             WHERE PROG_ID = :prog_id
             ORDER BY PENS_ID`,
            { prog_id: Number(prog_id) }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error en GET /api/pensums/:prog_id:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// Ejecutar SP que asigna el pensum y dispara la matricula en cascada
app.post('/api/asignar-pensum', async (req, res) => {
    let connection;
    try {
        const terc_id = Number(req.body.terc_id);
        const pens_id = Number(req.body.pens_id);

        if (!Number.isInteger(terc_id) || !Number.isInteger(pens_id)) {
            return res.status(400).json({ error: 'terc_id y pens_id son obligatorios y deben ser numericos' });
        }

        connection = await oracledb.getConnection();
        await connection.execute(
            `BEGIN
                SP_ING_TERC_PENSUMS(:T_ID, :P_ID);
             END;`,
            {
                T_ID: terc_id,
                P_ID: pens_id
            }
        );

        res.status(201).json({ message: 'Pensum asignado correctamente' });
    } catch (err) {
        console.error('Error en POST /api/asignar-pensum:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

// Consultar historial de materias matriculadas de un estudiante
app.get('/api/historial/:terc_id', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const { terc_id } = req.params;
        const result = await connection.execute(
            `SELECT H.CURS_ID, A.ASIG_ASIGNATURA, H.HIST_NOTA
             FROM HISTORIAS H, CURSOS C, ASIGNATURAS A
             WHERE H.CURS_ID = C.CURS_ID
               AND C.ASIG_ID = A.ASIG_ID
               AND H.TERC_ID = :terc_id
             ORDER BY H.CURS_ID`,
            { terc_id: Number(terc_id) }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error en GET /api/historial/:terc_id:', err);
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
    fs.createReadStream(req.file.path)
        .pipe(csv({ separator: ',' })) // Cambia a ';' si tu CSV usa punto y coma
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            let connection;
            try {
                connection = await oracledb.getConnection();
                let count = 0;
                
                for (const row of results) {
                    // Validación mínima: validamos que el número de documento no venga vacío
                    if (!row.nro_doc) continue;
                    
                    // Ejecución del Procedimiento Almacenado de Oracle
                    await connection.execute(
                        `BEGIN 
                            SP_ING_TERCEROS(
                                :tipo_doc, 
                                :nro_doc, 
                                :genero, 
                                :nombres, 
                                :apellidos, 
                                :direc, 
                                :correo, 
                                :movil, 
                                :tipo
                            ); 
                         END;`,
                        {
                            // Mapea aquí las cabeceras exactas que vienen en tu archivo CSV
                            tipo_doc:  row.tipo_doc || null,
                            nro_doc:   row.nro_doc,
                            genero:    row.genero || null,
                            nombres:   row.nombres || null,
                            apellidos: row.apellidos || null,
                            direc:     row.direc || null,
                            correo:    row.correo || null,
                            movil:     row.movil || null,
                            tipo:      row.tipo || null
                        }
                    );
                    count++;
                }
                
                await connection.commit(); // Confirmamos los inserts del SP
                res.json({ message: ` Importación exitosa: ${count} terceros procesados mediante SP.` });
            } catch (err) {
                console.error('Error en importación:', err);
                res.status(500).json({ error: 'Error en la base de datos: ' + err.message });
            } finally {
                if (connection) await connection.close();
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); 
            }
        });
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
