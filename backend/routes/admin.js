const express = require('express');
const authMiddleware = require('../middleware/auth');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const router = express.Router();

// Verificar si es admin
const adminMiddleware = (req, res, next) => {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  next();
};

// Obtener todos los empleados
router.get('/employees', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Crear empleado
router.post('/employees', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { fullName, documentNumber, socialSecurityNumber, sector } = req.body;
    
    const existingEmployee = await Employee.findOne({ documentNumber });
    if (existingEmployee) {
      return res.status(400).json({ message: 'Ya existe un empleado con este documento' });
    }

    const employee = new Employee({
      fullName,
      documentNumber,
      socialSecurityNumber,
      sector
    });

    await employee.save();
    res.status(201).json({ message: 'Empleado creado correctamente', employee });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Actualizar empleado
router.put('/employees/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { fullName, socialSecurityNumber, sector, isActive } = req.body;
    
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { fullName, socialSecurityNumber, sector, isActive },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ message: 'Empleado no encontrado' });
    }

    res.json({ message: 'Empleado actualizado correctamente', employee });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Eliminar empleado
router.delete('/employees/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Empleado no encontrado' });
    }

    res.json({ message: 'Empleado eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener registros de asistencia con filtros
router.get('/attendance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, employeeId, sector } = req.query;
    
    let filter = {};
    
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }
    
    if (employeeId) {
      filter.employee = employeeId;
    }
    
    let employeeFilter = {};
    if (sector) {
      employeeFilter.sector = sector;
    }

    const attendance = await Attendance.find(filter)
      .populate({
        path: 'employee',
        match: employeeFilter,
        select: 'fullName documentNumber socialSecurityNumber sector'
      })
      .sort({ date: -1 });

    // Filtrar resultados donde employee es null (por el match del sector)
    const filteredAttendance = attendance.filter(record => record.employee !== null);

    res.json(filteredAttendance);
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Exportar a Excel
router.get('/export/excel', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, employeeId, sector } = req.query;
    
    let filter = {};
    
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }
    
    if (employeeId) {
      filter.employee = employeeId;
    }
    
    let employeeFilter = {};
    if (sector) {
      employeeFilter.sector = sector;
    }

    const attendance = await Attendance.find(filter)
      .populate({
        path: 'employee',
        match: employeeFilter,
        select: 'fullName documentNumber socialSecurityNumber sector'
      })
      .sort({ date: -1 });

    const filteredAttendance = attendance.filter(record => record.employee !== null);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registros de Asistencia');

    // Encabezados
    worksheet.columns = [
      { header: 'Fecha', key: 'date', width: 15 },
      { header: 'Empleado', key: 'employeeName', width: 25 },
      { header: 'Documento', key: 'document', width: 15 },
      { header: 'NSS', key: 'nss', width: 20 },
      { header: 'Sector', key: 'sector', width: 10 },
      { header: 'Entrada', key: 'entry', width: 15 },
      { header: 'Pausa Fumar Inicio', key: 'smokingStart', width: 20 },
      { header: 'Pausa Fumar Fin', key: 'smokingEnd', width: 20 },
      { header: 'Pausa Comida Inicio', key: 'lunchStart', width: 20 },
      { header: 'Pausa Comida Fin', key: 'lunchEnd', width: 20 },
      { header: 'Salida', key: 'exit', width: 15 },
      { header: 'Horas Trabajadas', key: 'worked', width: 15 }
    ];

    // Datos
    filteredAttendance.forEach(record => {
      worksheet.addRow({
        date: record.date.toLocaleDateString('es-ES'),
        employeeName: record.employee.fullName,
        document: record.employee.documentNumber,
        nss: record.employee.socialSecurityNumber,
        sector: record.employee.sector,
        entry: record.entryTime ? record.entryTime.toLocaleTimeString('es-ES') : '',
        smokingStart: record.smokingBreakStart ? record.smokingBreakStart.toLocaleTimeString('es-ES') : '',
        smokingEnd: record.smokingBreakEnd ? record.smokingBreakEnd.toLocaleTimeString('es-ES') : '',
        lunchStart: record.lunchBreakStart ? record.lunchBreakStart.toLocaleTimeString('es-ES') : '',
        lunchEnd: record.lunchBreakEnd ? record.lunchBreakEnd.toLocaleTimeString('es-ES') : '',
        exit: record.exitTime ? record.exitTime.toLocaleTimeString('es-ES') : '',
        worked: record.totalWorkedTime ? `${Math.floor(record.totalWorkedTime / 60)}h ${record.totalWorkedTime % 60}m` : ''
      });
    });

    // Información de la empresa
    worksheet.addRow([]);
    worksheet.addRow(['La Lumbre de Rivas SL', 'B88007836']);
    worksheet.addRow(['Calle Juan de La Cierva, 58', 'Rivas Vaciamadrid - Madrid']);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=asistencia.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Exportar a PDF
router.get('/export/pdf', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, employeeId, sector } = req.query;
    
    let filter = {};
    
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }
    
    if (employeeId) {
      filter.employee = employeeId;
    }
    
    let employeeFilter = {};
    if (sector) {
      employeeFilter.sector = sector;
    }

    const attendance = await Attendance.find(filter)
      .populate({
        path: 'employee',
        match: employeeFilter,
        select: 'fullName documentNumber socialSecurityNumber sector'
      })
      .sort({ date: -1 });

    const filteredAttendance = attendance.filter(record => record.employee !== null);

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=asistencia.pdf');

    doc.pipe(res);

    // Encabezado
    doc.fontSize(20).text('La Lumbre de Rivas SL', { align: 'center' });
    doc.fontSize(12).text('B88007836', { align: 'center' });
    doc.fontSize(12).text('Calle Juan de La Cierva, 58 - Rivas Vaciamadrid - Madrid', { align: 'center' });
    doc.moveDown();

    // Información del reporte
    doc.fontSize(14).text('Reporte de Asistencia', { align: 'center' });
    if (startDate && endDate) {
      doc.fontSize(10).text(`Período: ${startDate} a ${endDate}`, { align: 'center' });
    }
    doc.moveDown();

    // Tabla de datos
    let yPosition = 200;
    const startX = 50;
    const rowHeight = 20;

    // Encabezados de la tabla
    doc.fontSize(8);
    doc.text('Fecha', startX, yPosition);
    doc.text('Empleado', startX + 60, yPosition);
    doc.text('Documento', startX + 160, yPosition);
    doc.text('Entrada', startX + 230, yPosition);
    doc.text('Salida', startX + 290, yPosition);
    doc.text('Horas', startX + 350, yPosition);

    yPosition += rowHeight;

    // Datos
    filteredAttendance.forEach(record => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 100;
      }

      doc.text(record.date.toLocaleDateString('es-ES'), startX, yPosition);
      doc.text(record.employee.fullName, startX + 60, yPosition, { width: 90 });
      doc.text(record.employee.documentNumber, startX + 160, yPosition);
      doc.text(record.entryTime ? record.entryTime.toLocaleTimeString('es-ES') : '-', startX + 230, yPosition);
      doc.text(record.exitTime ? record.exitTime.toLocaleTimeString('es-ES') : '-', startX + 290, yPosition);
      doc.text(record.totalWorkedTime ? `${Math.floor(record.totalWorkedTime / 60)}h ${record.totalWorkedTime % 60}m` : '-', startX + 350, yPosition);

      yPosition += rowHeight;
    });

    // Firmas
    doc.y = 650;
    doc.fontSize(10);
    doc.text('Firma del Empleado: _________________________', 50, doc.y);
    doc.text('Firma de la Empresa: _________________________', 300, doc.y);

    doc.end();
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;