require('dotenv').config();

console.log('🔍 DIAGNÓSTICO RENDER - POSTGRESQL');
console.log('====================================\n');

console.log('1. 🏷️  INFORMACIÓN DEL ENTORNO:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   RENDER:', process.env.RENDER ? '✅ Sí' : '❌ No');
console.log('   RENDER_SERVICE_ID:', process.env.RENDER_SERVICE_ID || 'No disponible');
console.log('   RENDER_INSTANCE_ID:', process.env.RENDER_INSTANCE_ID || 'No disponible');

console.log('\n2. 🔗 DATABASE_URL:');
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log('   ✅ Configurada');
    console.log('   Host:', url.hostname);
    console.log('   Puerto:', url.port || '5432');
    console.log('   BD:', url.pathname.replace('/', ''));
    console.log('   Usuario:', url.username);
    console.log('   SSL:', url.searchParams.get('ssl') || 'not specified');
  } catch (e) {
    console.log('   ❌ Error parseando URL');
  }
} else {
  console.log('   ❌ No configurada');
}

console.log('\n3. 🔌 TEST DE CONEXIÓN:');
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

client.connect()
  .then(() => {
    console.log('   ✅ Conexión exitosa');
    return client.query('SELECT version(), current_database()');
  })
  .then(result => {
    console.log('   📊 PostgreSQL:', result.rows[0].version.split(',')[0]);
    console.log('   🗄️  Base de datos:', result.rows[0].current_database);
    return client.end();
  })
  .then(() => {
    console.log('\n🎉 Todo correcto - La conexión debería funcionar');
  })
  .catch(error => {
    console.log('   ❌ Error:', error.message);
    console.log('\n🔧 SOLUCIONES PARA RENDER:');
    console.log('   1. Verifica que la PostgreSQL database esté creada');
    console.log('   2. En el Web Service, ve a Environment y verifica DATABASE_URL');
    console.log('   3. Si usas render.yaml, verifica la sintaxis');
    console.log('   4. Prueba recrear la base de datos completamente');
    
    if (error.message.includes('does not exist')) {
      console.log('   5. ⚠️  La base de datos no existe - Crea una nueva');
    }
  });