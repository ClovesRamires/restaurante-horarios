const express = require('express');
const cors = require('cors');
require('dotenv').config();

console.log('🚀 Iniciando servidor...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

const app = express();

// Middleware básico
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Importar database después de configurar console.log
const { pool, initDatabase, healthCheck } = require('./database');

// Variable para controlar el estado
let dbInitialized = false;
let initializationInProgress = false;

// Función de inicialización robusta
const initializeApp = async () => {
  if (initializationInProgress) {
    console.log('⏳ Inicialización ya en progreso...');
    return;
  }

  initializationInProgress = true;
  console.log('🔄 Iniciando proceso de inicialización...');

  const maxAttempts = 3;
  const retryDelay = 10000; // 10 segundos

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`\n🔧 Intento ${attempt} de ${maxAttempts}...`);
      await initDatabase();
      dbInitialized = true;
      initializationInProgress = false;
      console.log('🎉 Aplicación inicializada correctamente');
      return;
    } catch (error) {
      console.error(`❌ Intento ${attempt} fallado:`, error.message);
      
      if (attempt < maxAttempts) {
        console.log(`⏳ Esperando ${retryDelay / 1000} segundos antes del próximo intento...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('💥 Todos los intentos de inicialización fallaron');
        console.log('⚠️ El servidor continuará ejecutándose pero la base de datos no está disponible');
        initializationInProgress = false;
      }
    }
  }
};

// Ruta de salud muy simple y robusta
app.get('/api/health', async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.json({
        status: 'initializing',
        database: 'connecting',
        message: 'Sistema inicializando, por favor espere...',
        timestamp: new Date().toISOString()
      });
    }

    const health = await healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta simple de prueba
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Servidor funcionando',
    database: dbInitialized ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Middleware para verificar BD
const requireDB = (req, res, next) => {
  if (!dbInitialized) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'La base de datos se está inicializando, por favor intente nuevamente en unos momentos',
      status: 'initializing'
    });
  }
  next();
};

// Rutas de autenticación (simplificadas por ahora)
app.post('/api/auth/employee', requireDB, async (req, res) => {
  try {
    const { documentNumber } = req.body;
    
    const result = await pool.query(
      'SELECT id, full_name, document_number, sector FROM employees WHERE document_number = $1 AND is_active = true',
      [documentNumber]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Empleado no encontrado' });
    }

    res.json({
      success: true,
      employee: result.rows[0],
      message: 'Login exitoso'
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Iniciar inicialización en segundo plano
setTimeout(() => {
  initializeApp().catch(console.error);
}, 1000);

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎯 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📍 URL: http://0.0.0.0:${PORT}`);
  console.log(`🔍 Health check: /api/health`);
  console.log(`🧪 Test: /api/test`);
  console.log('\n📊 Estado de la aplicación:');
  console.log('   - Servidor: ✅ Ejecutándose');
  console.log('   - Base de datos: 🔄 Inicializando...');
});