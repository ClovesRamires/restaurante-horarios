const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Función para inicializar la base de datos
const initDatabase = async () => {
  try {
    console.log('🔄 Inicializando base de datos...');

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
      const bcrypt = require('bcryptjs');
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
        ('Carlos Martínez Ruiz', '11223344C', '281122334455', 'office'),
        ('Ana Fernández Díaz', '44332211D', '284433221100', 'cocina'),
        ('Laura Sánchez Martín', '55667788E', '285566778899', 'sala')
      `);
      console.log('✅ Empleados de ejemplo creados');
    }

    // Crear índices para mejor performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
      CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
      CREATE INDEX IF NOT EXISTS idx_employees_document ON employees(document_number);
      CREATE INDEX IF NOT EXISTS idx_employees_sector ON employees(sector);
    `);

    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
};

// Función de salud para verificar conexión
const healthCheck = async () => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as version');
    return {
      status: 'healthy',
      database: 'connected',
      current_time: result.rows[0].current_time,
      version: result.rows[0].version
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    };
  }
};

module.exports = {
  pool,
  initDatabase,
  healthCheck
};