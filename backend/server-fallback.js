const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Datos en memoria como fallback
let employees = [
  { id: 1, name: 'Juan Pérez', document: '12345678A', sector: 'cocina' },
  { id: 2, name: 'María García', document: '87654321B', sector: 'sala' }
];

let attendance = [];

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    database: 'memory_fallback',
    message: 'Usando almacenamiento en memoria' 
  });
});

app.post('/api/auth/employee', (req, res) => {
  const { documentNumber } = req.body;
  const employee = employees.find(emp => emp.document === documentNumber);
  
  if (employee) {
    res.json({ success: true, employee });
  } else {
    res.status(400).json({ message: 'Empleado no encontrado' });
  }
});

app.listen(5000, () => {
  console.log('🚀 Servidor funcionando con fallback en memoria');
});