const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// JWT Secret
const JWT_SECRET = 'la_lumbre_secret_2024_rivas';

// Base de datos en memoria (FUNCIONAL INMEDIATO)
let employees = [
  {
    id: 1,
    full_name: 'Juan Pérez González',
    document_number: '12345678A',
    social_security_number: '281234567890',
    sector: 'cocina',
    is_active: true
  },
  {
    id: 2,
    full_name: 'María García López',
    document_number: '87654321B', 
    social_security_number: '289876543210',
    sector: 'sala',
    is_active: true
  },
  {
    id: 3,
    full_name: 'Carlos Martínez Ruiz',
    document_number: '11223344C',
    social_security_number: '281122334455',
    sector: 'office',
    is_active: true
  }
];

let attendance = [];
let admins = [{ id: 1, username: 'admin', password: bcrypt.hashSync('Apolo13', 10) }];

// ==================== MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
};

// ==================== RUTAS PÚBLICAS ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    database: 'memory',
    message: 'Sistema 100% operativo',
    employees: employees.length,
    timestamp: new Date().toISOString()
  });
});

// Login empleado
app.post('/api/auth/employee', (req, res) => {
  try {
    const { documentNumber } = req.body;
    
    const employee = employees.find(emp => 
      emp.document_number === documentNumber && emp.is_active
    );

    if (!employee) {
      return res.status(400).json({ message: 'Empleado no encontrado' });
    }

    const token = jwt.sign(
      { 
        id: employee.id, 
        documentNumber: employee.document_number,
        type: 'employee'
      },
      JWT_SECRET,
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
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Login administrador
app.post('/api/auth/admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const admin = admins.find(a => a.username === username);
    if (!admin) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, type: 'admin' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ 
      success: true,
      token,
      admin: { id: admin.id, username: admin.username }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ==================== ASISTENCIA ====================
app.post('/api/attendance/entry', authenticateToken, (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const existing = attendance.find(a => 
      a.employee_id === employeeId && a.date === today
    );

    if (existing) {
      return res.status(400).json({ message: 'Ya se registró la entrada hoy' });
    }

    const record = {
      id: attendance.length + 1,
      employee_id: employeeId,
      date: today,
      entry_time: new Date().toISOString(),
      smoking_break_start: null,
      smoking_break_end: null,
      lunch_break_start: null,
      lunch_break_end: null,
      exit_time: null,
      total_worked_time: null,
      created_at: new Date().toISOString()
    };

    attendance.push(record);

    res.json({ 
      success: true,
      message: 'Entrada registrada correctamente', 
      attendance: record 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.post('/api/attendance/smoking-break/start', authenticateToken, (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const record = attendance.find(a => 
      a.employee_id === employeeId && a.date === today
    );

    if (!record) {
      return res.status(400).json({ message: 'Primero debe registrar la entrada' });
    }

    if (record.smoking_break_start) {
      return res.status(400).json({ message: 'Ya se inició pausa para fumar' });
    }

    record.smoking_break_start = new Date().toISOString();
    
    res.json({ success: true, message: 'Pausa para fumar iniciada' });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.post('/api/attendance/smoking-break/end', authenticateToken, (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const record = attendance.find(a => 
      a.employee_id === employeeId && a.date === today
    );

    if (!record || !record.smoking_break_start) {
      return res.status(400).json({ message: 'No se inició pausa para fumar' });
    }

    record.smoking_break_end = new Date().toISOString();
    
    res.json({ success: true, message: 'Pausa para fumar finalizada' });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.post('/api/attendance/lunch-break/start', authenticateToken, (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const record = attendance.find(a => 
      a.employee_id === employeeId && a.date === today
    );

    if (!record) {
      return res.status(400).json({ message: 'Primero debe registrar la entrada' });
    }

    if (record.lunch_break_start) {
      return res.status(400).json({ message: 'Ya se inició pausa para comida' });
    }

    record.lunch_break_start = new Date().toISOString();
    
    res.json({ success: true, message: 'Pausa para comida iniciada' });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.post('/api/attendance/lunch-break/end', authenticateToken, (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const record = attendance.find(a => 
      a.employee_id === employeeId && a.date === today
    );

    if (!record || !record.lunch_break_start) {
      return res.status(400).json({ message: 'No se inició pausa para comida' });
    }

    record.lunch_break_end = new Date().toISOString();
    
    res.json({ success: true, message: 'Pausa para comida finalizada' });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.post('/api/attendance/exit', authenticateToken, (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const record = attendance.find(a => 
      a.employee_id === employeeId && a.date === today
    );

    if (!record) {
      return res.status(400).json({ message: 'Primero debe registrar la entrada' });
    }

    record.exit_time = new Date().toISOString();
    
    // Calcular horas trabajadas
    const entry = new Date(record.entry_time);
    const exit = new Date(record.exit_time);
    let totalMinutes = (exit - entry) / (1000 * 60);

    // Restar pausas
    if (record.smoking_break_start && record.smoking_break_end) {
      const smoking = (new Date(record.smoking_break_end) - new Date(record.smoking_break_start)) / (1000 * 60);
      totalMinutes -= smoking;
    }

    if (record.lunch_break_start && record.lunch_break_end) {
      const lunch = (new Date(record.lunch_break_end) - new Date(record.lunch_break_start)) / (1000 * 60);
      totalMinutes -= lunch;
    }

    record.total_worked_time = Math.round(totalMinutes);

    res.json({ 
      success: true,
      message: 'Salida registrada correctamente',
      totalWorkedMinutes: record.total_worked_time
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.get('/api/attendance/today', authenticateToken, (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const record = attendance.find(a => 
      a.employee_id === employeeId && a.date === today
    );

    if (record) {
      const employee = employees.find(e => e.id === employeeId);
      res.json({
        success: true,
        attendance: {
          ...record,
          employee_name: employee.full_name,
          employee_sector: employee.sector
        }
      });
    } else {
      res.json({ success: true, attendance: null });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ==================== ADMIN ====================
app.get('/api/admin/employees', authenticateToken, (req, res) => {
  try {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    res.json({ success: true, employees });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.post('/api/admin/employees', authenticateToken, (req, res) => {
  try {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const { fullName, documentNumber, socialSecurityNumber, sector } = req.body;

    // Verificar si ya existe
    const existing = employees.find(emp => emp.document_number === documentNumber);
    if (existing) {
      return res.status(400).json({ message: 'Ya existe empleado con este documento' });
    }

    const newEmployee = {
      id: employees.length + 1,
      full_name: fullName,
      document_number: documentNumber,
      social_security_number: socialSecurityNumber,
      sector: sector,
      is_active: true
    };

    employees.push(newEmployee);

    res.status(201).json({ 
      success: true,
      message: 'Empleado creado correctamente', 
      employee: newEmployee 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.get('/api/admin/attendance', authenticateToken, (req, res) => {
  try {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const { startDate, endDate, sector } = req.query;
    
    let filtered = attendance.map(record => {
      const employee = employees.find(e => e.id === record.employee_id);
      return {
        ...record,
        employee_name: employee.full_name,
        employee_document: employee.document_number,
        employee_sector: employee.sector
      };
    });

    // Filtrar por fecha
    if (startDate && endDate) {
      filtered = filtered.filter(record => 
        record.date >= startDate && record.date <= endDate
      );
    }

    // Filtrar por sector
    if (sector) {
      filtered = filtered.filter(record => record.employee_sector === sector);
    }

    res.json({ success: true, attendance: filtered });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ==================== INICIO ====================
const PORT = process.env.PORT || 5000;
// ==================== RUTA RAIZ ====================
app.get('/', (req, res) => {
  res.json({
    message: '🏢 SISTEMA DE CONTROL DE HORARIOS - LA LUMBRE DE RIVAS',
    version: '1.0.0',
    status: 'operativo',
    endpoints: {
      health: '/api/health',
      auth: {
        employee: '/api/auth/employee',
        admin: '/api/auth/admin'
      },
      attendance: {
        entry: '/api/attendance/entry',
        smoking_break: {
          start: '/api/attendance/smoking-break/start',
          end: '/api/attendance/smoking-break/end'
        },
        lunch_break: {
          start: '/api/attendance/lunch-break/start', 
          end: '/api/attendance/lunch-break/end'
        },
        exit: '/api/attendance/exit',
        today: '/api/attendance/today'
      },
      admin: {
        employees: '/api/admin/employees',
        attendance: '/api/admin/attendance'
      }
    },
    credentials: {
      admin: { username: 'admin', password: 'Apolo13' },
      employees: [
        { document: '12345678A', name: 'Juan Pérez', sector: 'cocina' },
        { document: '87654321B', name: 'María García', sector: 'sala' },
        { document: '11223344C', name: 'Carlos Martínez', sector: 'office' }
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== INICIO ====================
const PORT = process.env.PORT || 5000;
// Servir archivos estáticos (agrega esto después de los middleware)
app.use(express.static('public'));

// Ruta para servir el frontend móvil
app.get('/mobile', (req, res) => {
  res.sendFile(__dirname + '/public/mobile.html');
});

// Ruta para servir el frontend escritorio  
app.get('/desktop', (req, res) => {
  res.sendFile(__dirname + '/public/desktop.html');
});

// Ruta para servir el admin
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 SISTEMA LA LUMBRE - 100% OPERATIVO');
  console.log(`📍 URL: https://tu-app.onrender.com`);
  console.log(`🔧 Puerto: ${PORT}`);
  console.log('\n📊 ESTADO:');
  console.log('   ✅ Servidor: Funcionando');
  console.log('   ✅ Base de datos: En memoria (SQLite)');
  console.log('   ✅ Empleados: 3 cargados');
  console.log('\n🔐 CREDENCIALES:');
  console.log('   👨‍💼 Admin: usuario "admin", contraseña "Apolo13"');
  console.log('   👨‍🍳 Empleados: documentos 12345678A, 87654321B, 11223344C');
  console.log('\n🌐 ENDPOINTS PRINCIPALES:');
  console.log('   📍 Raíz: /');
  console.log('   ❤️  Health: /api/health');
  console.log('   🔐 Login empleado: /api/auth/employee');
  console.log('   👑 Login admin: /api/auth/admin');
});
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 SISTEMA LA LUMBRE - 100% OPERATIVO');
  console.log(`📍 URL: https://tu-app.onrender.com`);
  console.log(`🔧 Puerto: ${PORT}`);
  console.log('\n📊 ESTADO:');
  console.log('   ✅ Servidor: Funcionando');
  console.log('   ✅ Base de datos: En memoria (SQLite)');
  console.log('   ✅ Empleados: 3 cargados');
  console.log('\n🔐 CREDENCIALES:');
  console.log('   👨‍💼 Admin: usuario "admin", contraseña "Apolo13"');
  console.log('   👨‍🍳 Empleados: documentos 12345678A, 87654321B, 11223344C');
  console.log('\n🌐 ENDPOINTS:');
  console.log('   📍 Health: /api/health');
  console.log('   🔐 Login: /api/auth/employee');
  console.log('   👑 Admin: /api/auth/admin');
  console.log('   ⏰ Asistencia: /api/attendance/entry');
});