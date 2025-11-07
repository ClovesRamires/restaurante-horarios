const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware básico
app.use(cors());
app.use(express.json());

console.log('🚀 Iniciando servidor en Render...');

// Importar después de console.log
const { pool, initDatabase, healthCheck } = require('./database');

let dbReady = false;

// Ruta de health check que siempre funciona
app.get('/api/health', async (req, res) => {
  if (!dbReady) {
    return res.json({
      status: 'initializing',
      message: 'Sistema iniciándose...',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const health = await healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta de prueba simple
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Servidor funcionando',
    database: dbReady ? 'conectado' : 'inicializando',
    timestamp: new Date().toISOString()
  });
});

// Ruta de diagnóstico
app.get('/api/debug', (req, res) => {
  res.json({
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? 'configurada' : 'no configurada'
    },
    database: {
      ready: dbReady,
      connection: 'pending'
    },
    timestamp: new Date().toISOString()
  });
});

// Inicialización asíncrona
const initializeDB = async () => {
  console.log('🔄 Inicializando base de datos...');
  
  try {
    await initDatabase();
    dbReady = true;
    console.log('✅ Base de datos lista');
  } catch (error) {
    console.error('❌ Error inicializando BD:', error.message);
    console.log('⚠️ Continuando sin base de datos...');
    
    // Intentar nuevamente en 30 segundos
    setTimeout(initializeDB, 30000);
  }
};

// Iniciar después de que el servidor esté listo
setTimeout(initializeDB, 2000);

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎯 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📍 URLs disponibles:`);
  console.log(`   - Health: https://tu-app.onrender.com/api/health`);
  console.log(`   - Test: https://tu-app.onrender.com/api/test`);
  console.log(`   - Debug: https://tu-app.onrender.com/api/debug`);
});