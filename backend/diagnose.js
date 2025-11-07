require('dotenv').config();

console.log('🔍 DIAGNÓSTICO AVANZADO - CONEXIÓN POSTGRESQL');
console.log('==============================================\n');

// Verificar variables críticas
console.log('1. 📋 VARIABLES DE ENTORNO CRÍTICAS:');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'No configurado');
console.log('   PORT:', process.env.PORT || 'No configurado');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA');

if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log('   Host:', url.hostname);
    console.log('   Puerto:', url.port);
    console.log('   Base de datos:', url.pathname.substring(1));
    console.log('   Usuario:', url.username);
    console.log('   SSL:', url.searchParams.get('ssl'));
  } catch (e) {
    console.log('   ❌ Error parseando DATABASE_URL');
  }
}

console.log('\n2. 📦 DEPENDENCIAS:');
try {
  const pg = require('pg');
  console.log('   pg:', '✅', pg.version);
} catch (error) {
  console.log('   pg:', '❌ NO INSTALADO');
}

console.log('\n3. 🔌 TEST DE CONEXIÓN DIRECTA:');
const { Client } = require('pg');

const clientConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  connectionTimeoutMillis: 10000,
  query_timeout: 10000,
  statement_timeout: 10000
};

const client = new Client(clientConfig);

client.connect()
  .then(() => {
    console.log('   ✅ Conexión directa exitosa');
    
    return client.query('SELECT version(), current_database(), current_user');
  })
  .then(result => {
    console.log('   📊 Versión PostgreSQL:', result.rows[0].version.split(',')[0]);
    console.log('   🗄️  Base de datos:', result.rows[0].current_database);
    console.log('   👤 Usuario:', result.rows[0].current_user);
    
    return client.query('SELECT table_name FROM information_schema.tables WHERE table_schema = $1', ['public']);
  })
  .then(result => {
    console.log('   📋 Tablas existentes:', result.rows.map(row => row.table_name).join(', ') || 'Ninguna');
    
    client.end();
    console.log('\n🎉 DIAGNÓSTICO COMPLETADO - Todo parece correcto');
    console.log('💡 Si persiste el error, verifica en el dashboard de Render:');
    console.log('   - Que la base de datos esté en estado "Available"');
    console.log('   - Que la IP esté permitida en la configuración de red');
  })
  .catch(error => {
    console.log('   ❌ Error de conexión directa:', error.message);
    console.log('\n🔧 POSIBLES SOLUCIONES:');
    console.log('   1. Verifica que la base de datos PostgreSQL esté creada en Render');
    console.log('   2. Revisa que DATABASE_URL sea correcta en las variables de entorno');
    console.log('   3. Verifica la configuración de red de la base de datos');
    console.log('   4. Prueba recrear la base de datos en Render');
    
    if (error.message.includes('SSL')) {
      console.log('   5. 🔐 Problema SSL - La configuración actual debería manejarlo');
    }
    
    process.exit(1);
  });