const { Pool } = require('pg');
require('dotenv').config();

console.log('🔧 Configurando conexión a PostgreSQL...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL presente:', !!process.env.DATABASE_URL);

// Configuración robusta de PostgreSQL para Render
const getPoolConfig = () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL no está configurada');
    throw new Error('DATABASE_URL no configurada');
  }

  console.log('📊 Configurando pool de conexiones...');
  
  return {
    connectionString: connectionString,
    // Configuración SSL específica para Render
    ssl: {
      rejectUnauthorized: false,
      require: true
    },
    // Configuraciones de tiempo de espera
    connectionTimeoutMillis: 10000, // 10 segundos
    idleTimeoutMillis: 30000,
    max: 10,
    // Reintentos de conexión
    retry: {
      max: 3,
      timeout: 1000
    }
  };
};

let pool;

try {
  pool = new Pool(getPoolConfig());
  console.log('✅ Pool de conexiones creado');
  
  // Manejo de eventos para debugging
  pool.on('connect', (client) => {
    console.log('🔄 Nueva conexión establecida con PostgreSQL');
  });
  
  pool.on('acquire', (client) => {
    console.log('📥 Cliente adquirido del pool');
  });
  
  pool.on('remove', (client) => {
    console.log('📤 Cliente removido del pool');
  });
  
  pool.on('error', (err, client) => {
    console.error('❌ Error en el pool de PostgreSQL:', err);
  });
  
} catch (error) {
  console.error('💥 Error crítico creando el pool:', error);
  throw error;
}

// Función mejorada para probar conexión
const testConnection = async () => {
  let client;
  try {
    console.log('🔌 Intentando conectar a PostgreSQL...');
    console.log('Connection string:', process.env.DATABASE_URL ? '✅ Presente' : '❌ Ausente');
    
    client = await pool.connect();
    console.log('✅ Cliente conectado exitosamente');
    
    const result = await client.query('SELECT version(), NOW() as current_time');
    console.log('📊 PostgreSQL Version:', result.rows[0].version);
    console.log('⏰ Hora del servidor:', result.rows[0].current_time);
    
    // Verificar que podemos escribir
    await client.query('SELECT 1 as test');
    console.log('✅ Query de prueba ejecutada correctamente');
    
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Error en testConnection:', error.message);
    console.error('🔍 Detalles del error:', {
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    
    if (client) {
      try {
        client.release(true); // Liberar con error
      } catch (releaseError) {
        console.error('Error liberando cliente:', releaseError);
      }
    }
    return false;
  }
};

// Función para inicializar la base de datos
const initDatabase = async () => {
  console.log('🔄 Iniciando inicialización de base de datos...');
  
  try {
    // Primero probar la conexión básica
    const connected = await testConnection();
    if (!connected) {
      throw new Error('No se pudo establecer conexión inicial con la base de datos');
    }

    console.log('📁 Creando tablas...');

    // Tabla de empleados
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        document_number VARCHAR(50) UNIQUE NOT NULL,
        social_security_number VARCHAR(100) NOT NULL,
        sector VARCHAR(50) NOT NULL CHECK (sector IN ('cocina', 'office', 'sala')),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla employees creada/verificada');

    // Tabla de asistencia
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        entry_time TIMESTAMP WITH TIME ZONE,
        smoking_break_start TIMESTAMP WITH TIME ZONE,
        smoking_break_end TIMESTAMP WITH TIME ZONE,
        lunch_break_start TIMESTAMP WITH TIME ZONE,
        lunch_break_end TIMESTAMP WITH TIME ZONE,
        exit_time TIMESTAMP WITH TIME ZONE,
        total_worked_time INTEGER,
        signature TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla attendance creada/verificada');

    // Tabla de administradores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla admins creada/verificada');

    // Insertar admin por defecto
    const adminCheck = await pool.query('SELECT * FROM admins WHERE username = $1', ['admin']);
    if (adminCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Apolo13', 12);
      await pool.query(
        'INSERT INTO admins (username, password) VALUES ($1, $2)',
        ['admin', hashedPassword]
      );
      console.log('✅ Admin por defecto creado');
    } else {
      console.log('✅ Admin ya existe');
    }

    // Insertar empleados de ejemplo si no existen
    const employeesCheck = await pool.query('SELECT COUNT(*) FROM employees');
    if (parseInt(employeesCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO employees (full_name, document_number, social_security_number, sector) VALUES
        ('Juan Pérez González', '12345678A', '281234567890', 'cocina'),
        ('María García López', '87654321B', '289876543210', 'sala'),
        ('Carlos Martínez Ruiz', '11223344C', '281122334455', 'office')
      `);
      console.log('✅ Empleados de ejemplo creados');
    } else {
      console.log('✅ Empleados ya existen');
    }

    console.log('🎉 Base de datos inicializada completamente');
    return true;
  } catch (error) {
    console.error('💥 Error en initDatabase:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

// Función de salud mejorada
const healthCheck = async () => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as version');
    
    return {
      status: 'healthy',
      database: 'connected',
      current_time: result.rows[0].current_time,
      version: result.rows[0].version,
      message: 'Conexión a PostgreSQL establecida correctamente'
    };
  } catch (error) {
    console.error('Health check error:', error.message);
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      suggestion: 'Verificar la configuración de DATABASE_URL y SSL'
    };
  }
};

module.exports = {
  pool,
  initDatabase,
  healthCheck,
  testConnection
};