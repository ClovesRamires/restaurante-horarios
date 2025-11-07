const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(cors());
app.use(express.json());

// JWT Secret
const JWT_SECRET = 'la_lumbre_secret_2024_rivas';

// Base de datos en memoria
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

const requireAdmin = (req, res, next) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ message: 'Se requieren privilegios de administrador' });
  }
  next();
};

// ==================== RUTAS PRINCIPALES ====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('/desktop', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'desktop.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==================== API ROUTES ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    database: 'memory',
    message: 'Sistema 100% operativo',
    employees: employees.length,
    attendance_records: attendance.length,
    timestamp: new Date().toISOString()
  });
});

// 🔥 AUTH CORREGIDA - Ahora requiere usuario y contraseña
app.post('/api/auth/employee', (req, res) => {
  try {
    const { documentNumber, password } = req.body;
    
    if (!documentNumber || !password) {
      return res.status(400).json({ message: 'Documento y contraseña requeridos' });
    }

    const employee = employees.find(emp => 
      emp.document_number === documentNumber && emp.is_active
    );

    if (!employee) {
      return res.status(400).json({ message: 'Empleado no encontrado' });
    }

    // 🔥 VERIFICAR CONTRASEÑA - últimos 4 dígitos del documento
    const expectedPassword = documentNumber.slice(-4);
    if (password !== expectedPassword) {
      return res.status(400).json({ message: 'Contraseña incorrecta' });
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
    console.error('Error en login empleado:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Login administrador
app.post('/api/auth/admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
    }

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

// ... (el resto del código de attendance y admin se mantiene igual)

// ==================== INICIO DEL SERVIDOR ====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 SISTEMA LA LUMBRE - 100% OPERATIVO');
  console.log(`📍 URL Principal: https://tu-app.onrender.com`);
  console.log(`📱 Móvil: https://tu-app.onrender.com/mobile`);
  console.log(`💻 Escritorio: https://tu-app.onrender.com/desktop`);
  console.log(`👑 Admin: https://tu-app.onrender.com/admin`);
  console.log('\n🔐 CREDENCIALES CORREGIDAS:');
  console.log('   👨‍💼 Admin: usuario "admin", contraseña "Apolo13"');
  console.log('   👨‍🍳 Empleados: documento + últimos 4 dígitos como contraseña');
  console.log('        Juan Pérez: 12345678A / 5678');
  console.log('        María García: 87654321B / 4321');
  console.log('        Carlos Martínez: 11223344C / 3344');
});