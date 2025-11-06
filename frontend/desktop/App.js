import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = 'https://tu-app.render.com/api';

function DesktopApp() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [attendance, setAttendance] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/admin/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.filter(emp => emp.isActive));
      }
    } catch (error) {
      console.error('Error al cargar empleados:', error);
    }
  };

  const loginEmployee = async (employee) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentNumber: employee.documentNumber })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSelectedEmployee(data.employee);
        localStorage.setItem('token', data.token);
        checkTodayAttendance();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  const checkTodayAttendance = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/attendance/today`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAttendance(data);
      }
    } catch (error) {
      console.error('Error al obtener asistencia:', error);
    }
  };

  const registerAction = async (action) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const endpoints = {
        entry: '/attendance/entry',
        'smoking-start': '/attendance/smoking-break/start',
        'smoking-end': '/attendance/smoking-break/end',
        'lunch-start': '/attendance/lunch-break/start',
        'lunch-end': '/attendance/lunch-break/end',
        exit: '/attendance/exit'
      };

      const response = await fetch(`${API_BASE_URL}${endpoints[action]}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        checkTodayAttendance();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  const logout = () => {
    setSelectedEmployee(null);
    localStorage.removeItem('token');
    setAttendance(null);
  };

  if (!selectedEmployee) {
    return (
      <div className="desktop-container">
        <header className="desktop-header">
          <h1>Control de Horarios - La Lumbre de Rivas</h1>
          <p>Selecciona tu perfil para iniciar sesión</p>
        </header>

        <div className="employees-grid">
          {employees.map(employee => (
            <div 
              key={employee._id} 
              className="employee-card"
              onClick={() => loginEmployee(employee)}
            >
              <div className="employee-avatar">
                {employee.fullName.split(' ').map(n => n[0]).join('')}
              </div>
              <h3>{employee.fullName}</h3>
              <p>{employee.sector}</p>
              <small>{employee.documentNumber}</small>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="desktop-container">
      <header className="desktop-header">
        <h1>Bienvenido, {selectedEmployee.fullName}</h1>
        <p>Sector: {selectedEmployee.sector}</p>
        <button className="logout-btn" onClick={logout}>Cerrar Sesión</button>
      </header>

      <div className="attendance-panel">
        <div className="attendance-info">
          <h2>Registro de Hoy</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Entrada:</label>
              <span>{attendance?.entryTime ? new Date(attendance.entryTime).toLocaleTimeString() : 'No registrada'}</span>
            </div>
            <div className="info-item">
              <label>Pausa Fumar:</label>
              <span>
                {attendance?.smokingBreakStart ? 
                  `Iniciada ${new Date(attendance.smokingBreakStart).toLocaleTimeString()}` : 
                  'No iniciada'}
              </span>
            </div>
            <div className="info-item">
              <label>Pausa Comida:</label>
              <span>
                {attendance?.lunchBreakStart ? 
                  `Iniciada ${new Date(attendance.lunchBreakStart).toLocaleTimeString()}` : 
                  'No iniciada'}
              </span>
            </div>
            <div className="info-item">
              <label>Salida:</label>
              <span>{attendance?.exitTime ? new Date(attendance.exitTime).toLocaleTimeString() : 'No registrada'}</span>
            </div>
          </div>
        </div>

        <div className="actions-panel">
          {!attendance?.entryTime && (
            <button 
              className="action-btn entry"
              onClick={() => registerAction('entry')}
            >
              Registrar Entrada
            </button>
          )}

          {attendance?.entryTime && !attendance?.exitTime && (
            <>
              {!attendance?.smokingBreakStart ? (
                <button 
                  className="action-btn break"
                  onClick={() => registerAction('smoking-start')}
                >
                  Iniciar Pausa Fumar
                </button>
              ) : !attendance?.smokingBreakEnd && (
                <button 
                  className="action-btn break"
                  onClick={() => registerAction('smoking-end')}
                >
                  Finalizar Pausa Fumar
                </button>
              )}

              {!attendance?.lunchBreakStart ? (
                <button 
                  className="action-btn lunch"
                  onClick={() => registerAction('lunch-start')}
                >
                  Iniciar Pausa Comida
                </button>
              ) : !attendance?.lunchBreakEnd && (
                <button 
                  className="action-btn lunch"
                  onClick={() => registerAction('lunch-end')}
                >
                  Finalizar Pausa Comida
                </button>
              )}

              <button 
                className="action-btn exit"
                onClick={() => registerAction('exit')}
              >
                Registrar Salida
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DesktopApp;