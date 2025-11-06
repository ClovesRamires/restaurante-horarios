const { Pool } = require('pg');
require('dotenv').config();

// Configuración mejorada de PostgreSQL
const getPoolConfig = () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL no está configurada');
    throw new Error('DATABASE_URL no configurada');
  }

  return {
    connectionString: connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { 
      rejectUnauthorized: false 
    } : false,
    // Configuraciones adicionales para mejor estabilidad
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    max: 20, // máximo de conexiones en el pool
  };
};

let pool;

try {
  pool = new Pool(getPoolConfig());
  
  // Eventos del pool para debugging
  pool.on('connect', () => {
    console.log('✅ Nueva conexión a PostgreSQL establecida');
  });
  
  pool.on('error', (err) => {
    console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
  });
  
} catch (error) {
  console.error('❌ Error creando el pool de conexiones:', error);
  throw error;
}

// Función para probar la conexión
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conexión a PostgreSQL exitosa');
    
    const result = await client.query('SELECT version()');
    console.log('📊 Versión de PostgreSQL:', result.rows[0].version);
    
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    console.log('🔧 DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configurada' : '❌ No configurada');
    return false;
  }
};

// Función para inicializar la base de datos
const initDatabase = async () => {
  try {
    console.log('🔄 Inicializando base de datos...');
    
    // Primero probar la conexión
    const connected = await testConnection();
    if (!connected) {
      throw new Error('No se pudo conectar a la base de datos');
    }

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

    // Tabla de administradores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insertar admin por defecto
    const adminCheck = await pool.query('SELECT * FROM admins WHERE username = $1', ['admin']);
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('Apolo13', 12);
      await pool.query(
        'INSERT INTO admins (username, password) VALUES ($1, $2)',
        ['admin', hashedPassword]
      );
      console.log('✅ Admin por defecto creado (usuario: admin, contraseña: Apolo13)');
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
    }

    console.log('✅ Base de datos inicializada correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
};

// Función de salud mejorada
const healthCheck = async () => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as version');
    
    // Verificar también las tablas esenciales
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('employees', 'attendance', 'admins')
    `);
    
    const essentialTables = ['employees', 'attendance', 'admins'];
    const missingTables = essentialTables.filter(table => 
      !tablesCheck.rows.find(row => row.table_name === table)
    );

    return {
      status: 'healthy',
      database: 'connected',
      current_time: result.rows[0].current_time,
      version: result.rows[0].version,
      tables: {
        status: missingTables.length === 0 ? 'complete' : 'incomplete',
        missing: missingTables
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      suggestion: 'Verificar la configuración de DATABASE_URL en Render'
    };
  }
};

module.exports = {
  pool,
  initDatabase,
  healthCheck,
  testConnection
};