import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Alert, ScrollView, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../services/firebase';

export default function PrivacySecurityScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
    loadBiometricPref();
  }, []);

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricSupported(compatible && enrolled);
  };

  const loadBiometricPref = async () => {
    const enabled = await AsyncStorage.getItem('biometric_enabled');
    setBiometricEnabled(enabled === 'true');
  };

  const toggleBiometric = async (value) => {
    if (value && !biometricSupported) {
      Alert.alert('Not available', 'Your device does not support fingerprint / face ID or no biometrics are enrolled.');
      return;
    }
    if (value) {
      // Ask user to authenticate to enable
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login',
        fallbackLabel: 'Use password',
      });
      if (result.success) {
        
        await AsyncStorage.setItem('biometric_enabled', 'true');
        setBiometricEnabled(true);
        Alert.alert('Success', 'Biometric login enabled. Next time you login, you can use fingerprint.');
      } else {
        Alert.alert('Failed', 'Authentication failed. Biometric login not enabled.');
      }
    } else {
      await AsyncStorage.setItem('biometric_enabled', 'false');
      await SecureStore.deleteItemAsync('biometric_email');
      await SecureStore.deleteItemAsync('biometric_password');
      setBiometricEnabled(false);
      Alert.alert('Disabled', 'Biometric login has been disabled.');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.t1 }]}>Privacy & Security</Text>

        <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.t1 }]}>Biometric Login (Fingerprint / Face ID)</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: colors.border, true: colors.teal }}
              thumbColor={biometricEnabled ? colors.t1 : colors.t3}
            />
          </View>
          <Text style={[styles.note, { color: colors.t3 }]}>
            {biometricSupported ? 'Enable to use fingerprint or face ID for faster login.' : 'Biometric not available on this device or no fingerprint enrolled.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { padding: 24 },
  title: { fontSize: 28, fontWeight: '900', marginBottom: 24 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600' },
  note: { fontSize: 12, marginTop: 8 },
});