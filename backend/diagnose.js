require('dotenv').config();

console.log('🔍 DIAGNÓSTICO DE CONEXIÓN A POSTGRESQL');
console.log('=========================================');

// Verificar variables de entorno
console.log('\n1. 📋 Variables de entorno:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   PORT:', process.env.PORT);
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA');

if (process.env.DATABASE_URL) {
  // Ocultar contraseña por seguridad
  const maskedUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log('   DATABASE_URL (enmascarada):', maskedUrl);
}

// Verificar dependencias
console.log('\n2. 📦 Dependencias:');
try {
  const pg = require('pg');
  console.log('   pg:', '✅ INSTALADO');
} catch (error) {
  console.log('   pg:', '❌ NO INSTALADO - Ejecuta: npm install pg');
}

// Probar conexión básica
console.log('\n3. 🔌 Test de conexión:');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.query('SELECT NOW()')
  .then(result => {
    console.log('   ✅ Conexión exitosa:', result.rows[0].now);
    process.exit(0);
  })
  .catch(error => {
    console.log('   ❌ Error de conexión:', error.message);
    console.log('\n💡 SOLUCIONES SUGERIDAS:');
    console.log('   1. Verifica que DATABASE_URL esté configurada en Render');
    console.log('   2. Verifica que la base de datos PostgreSQL esté creada');
    console.log('   3. Revisa las credenciales de la base de datos');
    console.log('   4. Verifica la configuración de red en Render');
    process.exit(1);
  });