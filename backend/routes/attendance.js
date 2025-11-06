const express = require('express');
const authMiddleware = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const router = express.Router();

// Registrar entrada
router.post('/entry', authMiddleware, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Verificar si ya existe registro para hoy
    const existingAttendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });

    if (existingAttendance) {
      return res.status(400).json({ message: 'Ya se registró la entrada hoy' });
    }

    const attendance = new Attendance({
      employee: employeeId,
      entryTime: new Date()
    });

    await attendance.save();
    res.json({ message: 'Entrada registrada correctamente', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Registrar pausa para fumar
router.post('/smoking-break/start', authMiddleware, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No se encontró registro de entrada' });
    }

    if (attendance.smokingBreakStart) {
      return res.status(400).json({ message: 'Ya se inició pausa para fumar' });
    }

    attendance.smokingBreakStart = new Date();
    await attendance.save();

    res.json({ message: 'Pausa para fumar iniciada', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Registrar fin pausa para fumar
router.post('/smoking-break/end', authMiddleware, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });

    if (!attendance || !attendance.smokingBreakStart) {
      return res.status(400).json({ message: 'No se inició pausa para fumar' });
    }

    attendance.smokingBreakEnd = new Date();
    await attendance.save();

    res.json({ message: 'Pausa para fumar finalizada', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Registrar pausa para comida
router.post('/lunch-break/start', authMiddleware, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No se encontró registro de entrada' });
    }

    if (attendance.lunchBreakStart) {
      return res.status(400).json({ message: 'Ya se inició pausa para comida' });
    }

    attendance.lunchBreakStart = new Date();
    await attendance.save();

    res.json({ message: 'Pausa para comida iniciada', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Registrar fin pausa para comida
router.post('/lunch-break/end', authMiddleware, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });

    if (!attendance || !attendance.lunchBreakStart) {
      return res.status(400).json({ message: 'No se inició pausa para comida' });
    }

    attendance.lunchBreakEnd = new Date();
    await attendance.save();

    res.json({ message: 'Pausa para comida finalizada', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Registrar salida
router.post('/exit', authMiddleware, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No se encontró registro de entrada' });
    }

    if (attendance.exitTime) {
      return res.status(400).json({ message: 'Ya se registró la salida' });
    }

    attendance.exitTime = new Date();
    
    // Calcular tiempo total trabajado
    let totalMinutes = 0;
    if (attendance.entryTime) {
      const entry = new Date(attendance.entryTime);
      const exit = new Date(attendance.exitTime);
      totalMinutes = (exit - entry) / (1000 * 60);
      
      // Restar pausas
      if (attendance.smokingBreakStart && attendance.smokingBreakEnd) {
        const smokingBreak = (new Date(attendance.smokingBreakEnd) - new Date(attendance.smokingBreakStart)) / (1000 * 60);
        totalMinutes -= smokingBreak;
      }
      
      if (attendance.lunchBreakStart && attendance.lunchBreakEnd) {
        const lunchBreak = (new Date(attendance.lunchBreakEnd) - new Date(attendance.lunchBreakStart)) / (1000 * 60);
        totalMinutes -= lunchBreak;
      }
    }
    
    attendance.totalWorkedTime = Math.round(totalMinutes);
    await attendance.save();

    res.json({ message: 'Salida registrada correctamente', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener registro del día actual
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    }).populate('employee', 'fullName documentNumber sector');

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;