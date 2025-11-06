const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
require('dotenv').config();

const { pool, initDatabase, healthCheck } = require('./database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Inicializar base de datos al iniciar
initDatabase().catch(console.error);

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token de acceso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-restaurante-2024', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
};

// Middleware de administrador
const requireAdmin = (req, res, next) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ message: 'Se requieren privilegios de administrador' });
  }
  next();
};

// Ruta de salud
app.get('/api/health', async (req, res) => {
  const health = await healthCheck();
  res.json(health);
});

// ==================== AUTENTICACIÓN ====================

// Login empleado
app.post('/api/auth/employee', async (req, res) => {
  try {
    const { documentNumber } = req.body;
    
    if (!documentNumber) {
      return res.status(400).json({ message: 'Número de documento requerido' });
    }

    const result = await pool.query(
      `SELECT id, full_name, document_number, social_security_number, sector 
       FROM employees 
       WHERE document_number = $1 AND is_active = TRUE`,
      [documentNumber]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Empleado no encontrado o inactivo' });
    }

    const employee = result.rows[0];

    const token = jwt.sign(
      { 
        id: employee.id, 
        documentNumber: employee.document_number,
        type: 'employee'
      },
      process.env.JWT_SECRET || 'fallback-secret-restaurante-2024',
      { expiresIn: '10h' }
    );

    res.json({
      success: true,
      token,
      employee: {
        id: employee.id,
        fullName: employee.full_name,
        documentNumber: employee.document_number,
        socialSecurityNumber: employee.social_security_number,
        sector: employee.sector
      }
    });
  } catch (error) {
    console.error('Error en login empleado:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Login administrador
app.post('/api/auth/admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
    }

    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password);

    if (!validPassword) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username,
        type: 'admin'
      },
      process.env.JWT_SECRET || 'fallback-secret-restaurante-2024',
      { expiresIn: '8h' }
    );

    res.json({ 
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error('Error en login admin:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==================== ASISTENCIA - EMPLEADOS ====================

// Registrar entrada
app.post('/api/attendance/entry', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Verificar si ya existe registro para hoy
    const existingResult = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, today]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ message: 'Ya se registró la entrada hoy' });
    }

    const result = await pool.query(
      `INSERT INTO attendance (employee_id, entry_time) 
       VALUES ($1, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [employeeId]
    );

    res.json({ 
      success: true,
      message: 'Entrada registrada correctamente', 
      attendance: result.rows[0] 
    });
  } catch (error) {
    console.error('Error registrando entrada:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Iniciar pausa para fumar
app.post('/api/attendance/smoking-break/start', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const existingResult = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, today]
    );

    if (existingResult.rows.length === 0) {
      return res.status(400).json({ message: 'Primero debe registrar la entrada' });
    }

    const attendance = existingResult.rows[0];
    if (attendance.smoking_break_start) {
      return res.status(400).json({ message: 'Ya se inició pausa para fumar' });
    }

    await pool.query(
      'UPDATE attendance SET smoking_break_start = CURRENT_TIMESTAMP WHERE id = $1',
      [attendance.id]
    );

    res.json({ 
      success: true,
      message: 'Pausa para fumar iniciada' 
    });
  } catch (error) {
    console.error('Error iniciando pausa fumar:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Finalizar pausa para fumar
app.post('/api/attendance/smoking-break/end', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const existingResult = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, today]
    );

    if (existingResult.rows.length === 0 || !existingResult.rows[0].smoking_break_start) {
      return res.status(400).json({ message: 'No se inició pausa para fumar' });
    }

    const attendance = existingResult.rows[0];
    if (attendance.smoking_break_end) {
      return res.status(400).json({ message: 'Ya se finalizó pausa para fumar' });
    }

    await pool.query(
      'UPDATE attendance SET smoking_break_end = CURRENT_TIMESTAMP WHERE id = $1',
      [attendance.id]
    );

    res.json({ 
      success: true,
      message: 'Pausa para fumar finalizada' 
    });
  } catch (error) {
    console.error('Error finalizando pausa fumar:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Iniciar pausa para comida
app.post('/api/attendance/lunch-break/start', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const existingResult = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, today]
    );

    if (existingResult.rows.length === 0) {
      return res.status(400).json({ message: 'Primero debe registrar la entrada' });
    }

    const attendance = existingResult.rows[0];
    if (attendance.lunch_break_start) {
      return res.status(400).json({ message: 'Ya se inició pausa para comida' });
    }

    await pool.query(
      'UPDATE attendance SET lunch_break_start = CURRENT_TIMESTAMP WHERE id = $1',
      [attendance.id]
    );

    res.json({ 
      success: true,
      message: 'Pausa para comida iniciada' 
    });
  } catch (error) {
    console.error('Error iniciando pausa comida:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Finalizar pausa para comida
app.post('/api/attendance/lunch-break/end', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const existingResult = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, today]
    );

    if (existingResult.rows.length === 0 || !existingResult.rows[0].lunch_break_start) {
      return res.status(400).json({ message: 'No se inició pausa para comida' });
    }

    const attendance = existingResult.rows[0];
    if (attendance.lunch_break_end) {
      return res.status(400).json({ message: 'Ya se finalizó pausa para comida' });
    }

    await pool.query(
      'UPDATE attendance SET lunch_break_end = CURRENT_TIMESTAMP WHERE id = $1',
      [attendance.id]
    );

    res.json({ 
      success: true,
      message: 'Pausa para comida finalizada' 
    });
  } catch (error) {
    console.error('Error finalizando pausa comida:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Registrar salida
app.post('/api/attendance/exit', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const existingResult = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, today]
    );

    if (existingResult.rows.length === 0) {
      return res.status(400).json({ message: 'Primero debe registrar la entrada' });
    }

    const attendance = existingResult.rows[0];
    if (attendance.exit_time) {
      return res.status(400).json({ message: 'Ya se registró la salida' });
    }

    // Calcular tiempo trabajado
    const entryTime = new Date(attendance.entry_time);
    const exitTime = new Date();
    
    let totalMinutes = (exitTime - entryTime) / (1000 * 60);

    // Restar pausas
    if (attendance.smoking_break_start && attendance.smoking_break_end) {
      const smokingBreak = (new Date(attendance.smoking_break_end) - new Date(attendance.smoking_break_start)) / (1000 * 60);
      totalMinutes -= smokingBreak;
    }

    if (attendance.lunch_break_start && attendance.lunch_break_end) {
      const lunchBreak = (new Date(attendance.lunch_break_end) - new Date(attendance.lunch_break_start)) / (1000 * 60);
      totalMinutes -= lunchBreak;
    }

    await pool.query(
      `UPDATE attendance 
       SET exit_time = CURRENT_TIMESTAMP, total_worked_time = $1 
       WHERE id = $2`,
      [Math.round(totalMinutes), attendance.id]
    );

    res.json({ 
      success: true,
      message: 'Salida registrada correctamente',
      totalWorkedMinutes: Math.round(totalMinutes)
    });
  } catch (error) {
    console.error('Error registrando salida:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Obtener registro del día actual
app.get('/api/attendance/today', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT a.*, e.full_name, e.document_number, e.sector 
       FROM attendance a 
       JOIN employees e ON a.employee_id = e.id 
       WHERE a.employee_id = $1 AND a.date = $2`,
      [employeeId, today]
    );

    res.json({ 
      success: true,
      attendance: result.rows[0] || null 
    });
  } catch (error) {
    console.error('Error obteniendo asistencia hoy:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==================== ADMINISTRACIÓN ====================

// Obtener todos los empleados
app.get('/api/admin/employees', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, full_name, document_number, social_security_number, sector, is_active, created_at
      FROM employees 
      ORDER BY full_name
    `);
    
    res.json({ 
      success: true,
      employees: result.rows 
    });
  } catch (error) {
    console.error('Error obteniendo empleados:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Crear nuevo empleado
app.post('/api/admin/employees', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { fullName, documentNumber, socialSecurityNumber, sector } = req.body;

    if (!fullName || !documentNumber || !socialSecurityNumber || !sector) {
      return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    const result = await pool.query(
      `INSERT INTO employees (full_name, document_number, social_security_number, sector) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, full_name, document_number, social_security_number, sector, is_active`,
      [fullName, documentNumber, socialSecurityNumber, sector]
    );

    res.status(201).json({ 
      success: true,
      message: 'Empleado creado correctamente', 
      employee: result.rows[0] 
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Ya existe un empleado con este número de documento' });
    }
    console.error('Error creando empleado:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Actualizar empleado
app.put('/api/admin/employees/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, socialSecurityNumber, sector, isActive } = req.body;

    const result = await pool.query(
      `UPDATE employees 
       SET full_name = $1, social_security_number = $2, sector = $3, is_active = $4
       WHERE id = $5 
       RETURNING *`,
      [fullName, socialSecurityNumber, sector, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Empleado no encontrado' });
    }

    res.json({ 
      success: true,
      message: 'Empleado actualizado correctamente', 
      employee: result.rows[0] 
    });
  } catch (error) {
    console.error('Error actualizando empleado:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Obtener registros de asistencia con filtros
app.get('/api/admin/attendance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, employeeId, sector } = req.query;
    
    let query = `
      SELECT a.*, e.full_name, e.document_number, e.social_security_number, e.sector as employee_sector
      FROM attendance a 
      JOIN employees e ON a.employee_id = e.id 
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    if (startDate && endDate) {
      paramCount++;
      query += ` AND a.date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 1;
    }

    if (employeeId) {
      paramCount++;
      query += ` AND a.employee_id = $${paramCount}`;
      params.push(employeeId);
    }

    if (sector) {
      paramCount++;
      query += ` AND e.sector = $${paramCount}`;
      params.push(sector);
    }

    query += ' ORDER BY a.date DESC, e.full_name';

    const result = await pool.query(query, params);
    
    res.json({ 
      success: true,
      attendance: result.rows 
    });
  } catch (error) {
    console.error('Error obteniendo asistencia:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==================== EXPORTACIÓN ====================

// Exportar a Excel
app.get('/api/admin/export/excel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, employeeId, sector } = req.query;

    let query = `
      SELECT a.*, e.full_name, e.document_number, e.social_security_number, e.sector as employee_sector
      FROM attendance a 
      JOIN employees e ON a.employee_id = e.id 
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    if (startDate && endDate) {
      paramCount++;
      query += ` AND a.date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 1;
    }

    if (employeeId) {
      paramCount++;
      query += ` AND a.employee_id = $${paramCount}`;
      params.push(employeeId);
    }

    if (sector) {
      paramCount++;
      query += ` AND e.sector = $${paramCount}`;
      params.push(sector);
    }

    query += ' ORDER BY a.date DESC, e.full_name';

    const result = await pool.query(query, params);
    const attendanceData = result.rows;

    // Crear workbook de Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registros de Asistencia');

    // Estilos
    worksheet.columns = [
      { header: 'Fecha', key: 'date', width: 12 },
      { header: 'Empleado', key: 'employee_name', width: 25 },
      { header: 'Documento', key: 'document', width: 15 },
      { header: 'NSS', key: 'nss', width: 20 },
      { header: 'Sector', key: 'sector', width: 10 },
      { header: 'Entrada', key: 'entry', width: 15 },
      { header: 'Pausa Fumar Inicio', key: 'smoking_start', width: 20 },
      { header: 'Pausa Fumar Fin', key: 'smoking_end', width: 20 },
      { header: 'Pausa Comida Inicio', key: 'lunch_start', width: 20 },
      { header: 'Pausa Comida Fin', key: 'lunch_end', width: 20 },
      { header: 'Salida', key: 'exit', width: 15 },
      { header: 'Horas Trabajadas', key: 'worked', width: 15 }
    ];

    // Encabezados
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    // Datos
    attendanceData.forEach(record => {
      const workedTime = record.total_worked_time 
        ? `${Math.floor(record.total_worked_time / 60)}h ${record.total_worked_time % 60}m`
        : '';

      worksheet.addRow({
        date: new Date(record.date).toLocaleDateString('es-ES'),
        employee_name: record.full_name,
        document: record.document_number,
        nss: record.social_security_number,
        sector: record.employee_sector,
        entry: record.entry_time ? new Date(record.entry_time).toLocaleTimeString('es-ES') : '',
        smoking_start: record.smoking_break_start ? new Date(record.smoking_break_start).toLocaleTimeString('es-ES') : '',
        smoking_end: record.smoking_break_end ? new Date(record.smoking_break_end).toLocaleTimeString('es-ES') : '',
        lunch_start: record.lunch_break_start ? new Date(record.lunch_break_start).toLocaleTimeString('es-ES') : '',
        lunch_end: record.lunch_break_end ? new Date(record.lunch_break_end).toLocaleTimeString('es-ES') : '',
        exit: record.exit_time ? new Date(record.exit_time).toLocaleTimeString('es-ES') : '',
        worked: workedTime
      });
    });

    // Información de la empresa
    const lastRow = worksheet.rowCount + 2;
    worksheet.mergeCells(`A${lastRow}:F${lastRow}`);
    worksheet.getCell(`A${lastRow}`).value = 'La Lumbre de Rivas SL - B88007836';
    worksheet.getCell(`A${lastRow}`).font = { bold: true };
    
    worksheet.mergeCells(`A${lastRow + 1}:F${lastRow + 1}`);
    worksheet.getCell(`A${lastRow + 1}`).value = 'Calle Juan de La Cierva, 58 - Rivas Vaciamadrid - Madrid';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=asistencia_la_lumbre.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exportando Excel:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Exportar a PDF
app.get('/api/admin/export/pdf', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT a.*, e.full_name, e.document_number, e.social_security_number, e.sector as employee_sector
      FROM attendance a 
      JOIN employees e ON a.employee_id = e.id 
      WHERE 1=1
    `;
    let params = [];

    if (startDate && endDate) {
      query += ` AND a.date BETWEEN $1 AND $2`;
      params.push(startDate, endDate);
    }

    query += ' ORDER BY a.date DESC, e.full_name LIMIT 100';

    const result = await pool.query(query, params);
    const attendanceData = result.rows;

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=asistencia_la_lumbre.pdf');

    doc.pipe(res);

    // Encabezado
    doc.fontSize(20).font('Helvetica-Bold')
       .text('LA LUMBRE DE RIVAS SL', { align: 'center' });
    doc.fontSize(10).font('Helvetica')
       .text('B88007836', { align: 'center' });
    doc.text('Calle Juan de La Cierva, 58 - Rivas Vaciamadrid - Madrid', { align: 'center' });
    doc.moveDown(2);

    // Título del reporte
    doc.fontSize(16).font('Helvetica-Bold')
       .text('REPORTE DE ASISTENCIA', { align: 'center' });
    
    if (startDate && endDate) {
      doc.fontSize(10).text(`Período: ${startDate} a ${endDate}`, { align: 'center' });
    }
    
    doc.moveDown();

    // Tabla
    let y = 180;
    const startX = 50;
    const rowHeight = 20;

    // Encabezados de tabla
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('FECHA', startX, y);
    doc.text('EMPLEADO', startX + 60, y);
    doc.text('ENTRADA', startX + 200, y);
    doc.text('SALIDA', startX + 260, y);
    doc.text('HORAS', startX + 320, y);

    y += rowHeight;
    doc.font('Helvetica');

    // Datos
    attendanceData.forEach(record => {
      if (y > 700) {
        doc.addPage();
        y = 100;
      }

      const workedTime = record.total_worked_time 
        ? `${Math.floor(record.total_worked_time / 60)}h ${record.total_worked_time % 60}m`
        : '';

      doc.fontSize(8)
         .text(new Date(record.date).toLocaleDateString('es-ES'), startX, y)
         .text(record.full_name, startX + 60, y, { width: 130 })
         .text(record.entry_time ? new Date(record.entry_time).toLocaleTimeString('es-ES') : '-', startX + 200, y)
         .text(record.exit_time ? new Date(record.exit_time).toLocaleTimeString('es-ES') : '-', startX + 260, y)
         .text(workedTime, startX + 320, y);

      y += rowHeight;
    });

    // Firmas
    doc.y = 650;
    doc.fontSize(10)
       .text('Firma del Empleado: _________________________', 50, doc.y)
       .text('Firma de la Empresa: _________________________', 300, doc.y);

    doc.end();
  } catch (error) {
    console.error('Error exportando PDF:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==================== INICIALIZACIÓN ====================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor PostgreSQL ejecutándose en puerto ${PORT}`);
  console.log(`📊 Health check disponible en: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Admin por defecto: usuario "admin", contraseña "Apolo13"`);
});

module.exports = app;