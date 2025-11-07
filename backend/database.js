const { Pool } = require('pg');
require('dotenv').config();

console.log('🔧 Iniciando configuración de PostgreSQL para Render...');

// Configuración específica para Render
const getPoolConfig = () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL no configurada');
    console.log('💡 En Render, esto debería configurarse automáticamente');
    throw new Error('DATABASE_URL no configurada');
  }

  console.log('📊 DATABASE_URL detectada, configurando conexión...');

  // Configuración optimizada para Render
  return {
    connectionString: connectionString,
    // Configuración SSL crítica para Render
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false,
    // Timeouts aumentados
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    max: 10,
    allowExitOnIdle: true
  };
};

let pool;

try {
  pool = new Pool(getPoolConfig());
  console.log('✅ Pool de PostgreSQL creado');
} catch (error) {
  console.error('💥 Error creando pool:', error);
  throw error;
}

// Función de conexión simple y robusta
const testConnection = async () => {
  let client;
  try {
    console.log('🔌 Probando conexión a PostgreSQL...');
    
    // Conexión directa sin pool para diagnóstico
    const testClient = new (require('pg').Client)(getPoolConfig());
    
    await testClient.connect();
    console.log('✅ Conexión directa exitosa');
    
    const result = await testClient.query('SELECT version() as version, NOW() as time');
    console.log('📊 PostgreSQL:', result.rows[0].version);
    console.log('⏰ Hora servidor:', result.rows[0].time);
    
    await testClient.end();
    return true;
    
  } catch (error) {
    console.error('❌ Error en testConnection:', error.message);
    console.error('🔍 Código error:', error.code);
    console.error('🔍 Detalle:', error.detail);
    
    if (client) {
      try {
        await client.release();
      } catch (e) {
        // Ignorar errores al liberar
      }
    }
    return false;
  }
};

// Inicialización simplificada
const initDatabase = async () => {
  console.log('🔄 Iniciando inicialización de BD...');
  
  try {
    // Test de conexión básico
    const connected = await testConnection();
    if (!connected) {
      throw new Error('No se pudo conectar a PostgreSQL');
    }

    console.log('📁 Creando esquema de base de datos...');

    // Solo las tablas esenciales
    const tables = [
      `CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        document_number VARCHAR(50) UNIQUE NOT NULL,
        social_security_number VARCHAR(100) NOT NULL,
        sector VARCHAR(50) NOT NULL CHECK (sector IN ('cocina', 'office', 'sala')),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        date DATE DEFAULT CURRENT_DATE,
        entry_time TIMESTAMP,
        smoking_break_start TIMESTAMP,
        smoking_break_end TIMESTAMP,
        lunch_break_start TIMESTAMP,
        lunch_break_end TIMESTAMP,
        exit_time TIMESTAMP,
        total_worked_time INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const tableSql of tables) {
      await pool.query(tableSql);
    }
    console.log('✅ Tablas creadas/verificadas');

    // Admin por defecto
    const { rows: adminRows } = await pool.query('SELECT id FROM admins WHERE username = $1', ['admin']);
    if (adminRows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Apolo13', 10);
      await pool.query(
        'INSERT INTO admins (username, password) VALUES ($1, $2)',
        ['admin', hashedPassword]
      );
      console.log('✅ Admin creado (admin/Apolo13)');
    }

    // Empleados de ejemplo
    const { rows: employeeRows } = await pool.query('SELECT COUNT(*) as count FROM employees');
    if (parseInt(employeeRows[0].count) === 0) {
      await pool.query(`
        INSERT INTO employees (full_name, document_number, social_security_number, sector) VALUES
        ('Juan Pérez', '12345678A', '281234567890', 'cocina'),
        ('María García', '87654321B', '289876543210', 'sala'),
        ('Carlos López', '11223344C', '281122334455', 'office')
      `);
      console.log('✅ Empleados de ejemplo creados');
    }

    console.log('🎉 Base de datos inicializada completamente');
    return true;

  } catch (error) {
    console.error('💥 Error en initDatabase:', error.message);
    throw error;
  }
};

const healthCheck = async () => {
  try {
    const result = await pool.query('SELECT 1 as test');
    return {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  pool,
  initDatabase,
  healthCheck,
  testConnection
};