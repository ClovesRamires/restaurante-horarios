const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { pool, initDatabase, healthCheck } = require('./database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Variable para controlar el estado de la base de datos
let dbInitialized = false;

// Inicializar base de datos con reintentos
const initializeApp = async () => {
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts && !dbInitialized) {
    try {
      console.log(`🔄 Intento ${attempts + 1} de conectar a la base de datos...`);
      await initDatabase();
      dbInitialized = true;
      console.log('✅ Base de datos conectada e inicializada correctamente');
      break;
    } catch (error) {
      attempts++;
      console.error(`❌ Intento ${attempts} fallado:`, error.message);
      
      if (attempts < maxAttempts) {
        console.log(`⏳ Reintentando en 5 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.error('💥 No se pudo conectar a la base de datos después de varios intentos');
        // No salir del proceso, permitir que el servidor arranque igual
      }
    }
  }
};

// Ruta de salud mejorada
app.get('/api/health', async (req, res) => {
  try {
    const health = await healthCheck();
    
    // Información adicional útil para debugging
    const debugInfo = {
      database_url: process.env.DATABASE_URL ? '✅ Configurada' : '❌ No configurada',
      node_env: process.env.NODE_ENV,
      port: process.env.PORT,
      db_initialized: dbInitialized,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      ...health,
      debug: debugInfo,
      message: dbInitialized ? 'Sistema operativo correctamente' : 'Sistema iniciando...'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'connection_failed',
      error: error.message,
      debug: {
        database_url: process.env.DATABASE_URL ? '✅ Configurada' : '❌ No configurada',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Middleware para verificar si la BD está lista
const checkDBReady = (req, res, next) => {
  if (!dbInitialized) {
    return res.status(503).json({ 
      message: 'Sistema inicializando, por favor espere...',
      status: 'initializing'
    });
  }
  next();
};

// El resto de tus rutas aquí (usando checkDBReady)...
app.post('/api/auth/employee', checkDBReady, async (req, res) => {
  // Tu código de login de empleado...
});

// Inicializar la aplicación
initializeApp();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});