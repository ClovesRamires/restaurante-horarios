import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';

const API_BASE_URL = 'https://tu-app.render.com/api';

export default function MobileApp() {
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [isConnectedToWifi, setIsConnectedToWifi] = useState(false);

  useEffect(() => {
    checkWifiConnection();
    checkTodayAttendance();
  }, []);

  const checkWifiConnection = () => {
    // En una app nativa usaríamos NetInfo
    // Para web, simulamos la verificación
    const isWireOmega = window.location.hostname === 'localhost' || 
                        navigator.connection?.effectiveType === 'wifi';
    setIsConnectedToWifi(isWireOmega);
    
    if (!isWireOmega) {
      Alert.alert('Error', 'Solo se puede usar en la red WiFi WireOmega');
    }
  };

  const login = async (documentNumber) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentNumber })
      });

      const data = await response.json();
      
      if (response.ok) {
        setEmployee(data.employee);
        localStorage.setItem('token', data.token);
        checkTodayAttendance();
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
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
    if (!isConnectedToWifi) {
      Alert.alert('Error', 'Conéctate a la red WiFi WireOmega');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'Debes iniciar sesión primero');
      return;
    }

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
        Alert.alert('Éxito', data.message);
        checkTodayAttendance();
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    }
  };

  if (!employee) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Control de Horarios</Text>
        <Text style={styles.subtitle}>La Lumbre de Rivas</Text>
        
        <View style={styles.loginContainer}>
          <Text style={styles.loginTitle}>Iniciar Sesión</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => login('12345678A')} // Ejemplo
          >
            <Text style={styles.buttonText}>Juan Pérez (Cocina)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => login('87654321B')} // Ejemplo
          >
            <Text style={styles.buttonText}>María García (Sala)</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Bienvenido, {employee.fullName}</Text>
      <Text style={styles.sector}>Sector: {employee.sector}</Text>

      <View style={styles.attendanceInfo}>
        <Text style={styles.infoTitle}>Registro de Hoy:</Text>
        <Text>Entrada: {attendance?.entryTime ? new Date(attendance.entryTime).toLocaleTimeString() : 'No registrada'}</Text>
        <Text>Pausa fumar: {attendance?.smokingBreakStart ? 'Iniciada' : 'No iniciada'}</Text>
        <Text>Pausa comida: {attendance?.lunchBreakStart ? 'Iniciada' : 'No iniciada'}</Text>
        <Text>Salida: {attendance?.exitTime ? new Date(attendance.exitTime).toLocaleTimeString() : 'No registrada'}</Text>
      </View>

      <View style={styles.buttonsContainer}>
        {!attendance?.entryTime && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => registerAction('entry')}
          >
            <Text style={styles.buttonText}>Registrar Entrada</Text>
          </TouchableOpacity>
        )}

        {attendance?.entryTime && !attendance?.exitTime && (
          <>
            {!attendance?.smokingBreakStart ? (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => registerAction('smoking-start')}
              >
                <Text style={styles.buttonText}>Iniciar Pausa Fumar</Text>
              </TouchableOpacity>
            ) : !attendance?.smokingBreakEnd && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => registerAction('smoking-end')}
              >
                <Text style={styles.buttonText}>Finalizar Pausa Fumar</Text>
              </TouchableOpacity>
            )}

            {!attendance?.lunchBreakStart ? (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => registerAction('lunch-start')}
              >
                <Text style={styles.buttonText}>Iniciar Pausa Comida</Text>
              </TouchableOpacity>
            ) : !attendance?.lunchBreakEnd && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => registerAction('lunch-end')}
              >
                <Text style={styles.buttonText}>Finalizar Pausa Comida</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.exitButton}
              onPress={() => registerAction('exit')}
            >
              <Text style={styles.buttonText}>Registrar Salida</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => {
            setEmployee(null);
            localStorage.removeItem('token');
          }}
        >
          <Text style={styles.buttonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>

      {!isConnectedToWifi && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>⚠️ Conéctate a WiFi WireOmega</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  loginContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    elevation: 3,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 