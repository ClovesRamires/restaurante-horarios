const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');
const router = express.Router();

// Login empleado
router.post('/employee', async (req, res) => {
  try {
    const { documentNumber } = req.body;
    
    const employee = await Employee.findOne({ documentNumber, isActive: true });
    if (!employee) {
      return res.status(400).json({ message: 'Empleado no encontrado' });
    }

    const password = documentNumber.slice(-4);
    
    const token = jwt.sign(
      { id: employee._id, documentNumber: employee.documentNumber },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      employee: {
        id: employee._id,
        fullName: employee.fullName,
        documentNumber: employee.documentNumber,
        sector: employee.sector
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Login admin
router.post('/admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (username === 'admin' && password === 'Apolo13') {
      // Crear admin si no existe
      let admin = await Admin.findOne({ username: 'admin' });
      if (!admin) {
        const hashedPassword = await bcrypt.hash('Apolo13', 10);
        admin = new Admin({ username: 'admin', password: hashedPassword });
        await admin.save();
      }

      const token = jwt.sign(
        { id: admin._id, username: admin.username },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '8h' }
      );

      res.json({ token });
    } else {
      res.status(400).json({ message: 'Credenciales inválidas' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;