import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
  KeyboardAvoidingView, Platform, StatusBar, Modal, TextInput
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { User, Lock, Eye, EyeOff, Car, Bike, Truck, MapPin, Mail, X } from 'lucide-react-native';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { PrimaryButton, InputField, Loader } from '../components/UI';
import { useTheme } from '../context/ThemeContext';

const hashPassword = async (password) => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
};


const VEHICLE_OPTIONS = [
  { key: 'car', label: 'Car', icon: Car },
  { key: 'motorcycle', label: 'Motorcycle', icon: Bike },
  { key: 'truck', label: 'Truck', icon: Truck },
  { key: 'bajaj', label: 'Bajaj', icon: Bike },
];

export default function LoginScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  
  const [is2FARequired, setIs2FARequired] = useState(false);
  const [tempUserId, setTempUserId] = useState(null);
  const [tempEmail, setTempEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAHint, setTwoFAHint] = useState('');

  
  const [selectedVehicle, setSelectedVehicle] = useState('car');

  
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    attemptBiometricLogin();
    loadLastVehicleChoice();
  }, []);

  
  const loadLastVehicleChoice = async () => {
    try {
      const saved = await AsyncStorage.getItem('active_session_vehicle_type');
      if (saved === 'car' || saved === 'motorcycle' || saved === 'truck' || saved === 'bajaj') {
        setSelectedVehicle(saved);
      }
    } catch (e) {}
  };

  const attemptBiometricLogin = async () => {
    const biometricEnabled = await AsyncStorage.getItem('biometric_enabled');
    if (biometricEnabled !== 'true') return;
    const storedEmail = await SecureStore.getItemAsync('biometric_email');
    const storedPassword = await SecureStore.getItemAsync('biometric_password');
    if (!storedEmail || !storedPassword) return;
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled) {
      await AsyncStorage.setItem('biometric_enabled', 'false');
      return;
    }
    setLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('privacySecurity.verifyBiometric'),
        fallbackLabel: t('common.cancel'),
        disableDeviceFallback: false,
      });
      if (result.success) {
        await performLogin(storedEmail, storedPassword, true);
      }
    } catch (error) {
      console.log('Biometric error', error);
    } finally {
      setLoading(false);
    }
  };

  const performLogin = async (emailOrUsername, passwordInput, isAuto = false) => {
    try {
      let email = emailOrUsername;
      let userId = null;

      
      if (!emailOrUsername.includes('@')) {
        const q = query(collection(db, 'users'), where('username', '==', emailOrUsername));
        const querySnap = await getDocs(q);
        if (querySnap.empty) {
          if (!isAuto) Alert.alert(t('login.userNotFound'), t('login.userNotFoundMsg'));
          return false;
        }
        email = querySnap.docs[0].data().email;
        userId = querySnap.docs[0].id;
      } else {
        const q = query(collection(db, 'users'), where('email', '==', emailOrUsername));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) userId = querySnap.docs[0].id;
      }

      
      const userDoc = await getDoc(doc(db, 'users', userId));
      const twoFactorEnabled = userDoc.data()?.twoFactorEnabled || false;
      const twoFactorHint = userDoc.data()?.twoFactorHint || '';
      if (twoFactorEnabled) {
        setTempUserId(userId);
        setTempEmail(email);
        setTempPassword(passwordInput);
        setTwoFAHint(twoFactorHint);
        setIs2FARequired(true);
        return false;
      }

      
      await auth.signInWithEmailAndPassword(email, passwordInput);

      
      const biometricPref = await AsyncStorage.getItem('biometric_enabled');
      if (biometricPref === 'true') {
        await SecureStore.setItemAsync('biometric_email', email);
        await SecureStore.setItemAsync('biometric_password', passwordInput);
      }

      
      await AsyncStorage.setItem('active_session_vehicle_type', selectedVehicle);

      navigation.replace('Main');
      return true;
    } catch (e) {
      if (!isAuto) {
        if (e.code === 'auth/wrong-password') Alert.alert(t('login.wrongPassword'), t('login.tryAgain'));
        else Alert.alert(t('login.failed'), e.message);
      }
      return false;
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert(t('errors.missingFields'), t('common.pleaseFill'));
      return;
    }
    setLoading(true);
    await performLogin(username, password, false);
    setLoading(false);
  };

  
  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      Alert.alert('Email Sent', `Password reset link sent to ${resetEmail}.`, [
        { text: 'OK', onPress: () => { setShowForgotModal(false); setResetEmail(''); } }
      ]);
    } catch (error) {
      let msg = 'Failed to send reset email.';
      if (error.code === 'auth/user-not-found') msg = 'No account with this email.';
      else if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
      Alert.alert('Error', msg);
    } finally {
      setResetting(false);
    }
  };

  
  const verify2FA = async () => {
    const code = twoFACode || '';
    if (!code) {
      Alert.alert(t('common.error'), t('privacySecurity.enter2FAPassword'));
      return;
    }
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', tempUserId));
      const realCode = userDoc.data()?.twoFactorCode || '';
      if (code === realCode) {
        await auth.signInWithEmailAndPassword(tempEmail, tempPassword);
        await AsyncStorage.setItem('active_session_vehicle_type', selectedVehicle);
        setIs2FARequired(false);
        navigation.replace('Main');
      } else {
        Alert.alert('Error', 'Invalid 2FA code');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

 
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.t1 }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.t2 }]}>Sign in to continue</Text>
        </View>

        {/* Username Input */}
        <InputField
          icon={<User size={20} color={colors.t3} />}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        {/* Password Input with Eye/EyeOff toggle */}
        <InputField
          icon={<Lock size={20} color={colors.t3} />}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          rightIcon={
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={20} color={colors.t3} /> : <Eye size={20} color={colors.t3} />}
            </TouchableOpacity>
          }
        />

        {/* Forgot Password */}
        <TouchableOpacity onPress={() => setShowForgotModal(true)} style={styles.forgotBtn}>
          <Text style={[styles.forgotText, { color: colors.teal }]}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Vehicle selection */}
        <Text style={[styles.sectionLabel, { color: colors.t2 }]}>Select Vehicle Type</Text>
        <View style={styles.vehicleRow}>
          {VEHICLE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = selectedVehicle === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSelectedVehicle(opt.key)}
                style={[
                  styles.vehicleBtn,
                  { borderColor: active ? colors.teal : colors.border, backgroundColor: active ? colors.teal + '20' : colors.bg2 }
                ]}
              >
                <Icon size={22} color={active ? colors.teal : colors.t2} />
                <Text style={[styles.vehicleLabel, { color: active ? colors.teal : colors.t2 }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Login Button */}
        <PrimaryButton
          label={loading ? 'Logging in...' : 'Login'}
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.loginBtn}
        />
      </ScrollView>

      {/* ─── 2FA MODAL ──────────────────────────── */}
      <Modal visible={is2FARequired} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg2 }]}>
            <Text style={[styles.modalTitle, { color: colors.t1 }]}>{t('privacySecurity.2faTitle')}</Text>
            {twoFAHint ? <Text style={[styles.hint, { color: colors.t3 }]}>{t('privacySecurity.hint')}: {twoFAHint}</Text> : null}
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.t1 }]}
              value={twoFACode}
              onChangeText={setTwoFACode}
              placeholder={t('privacySecurity.enter2FACode')}
              placeholderTextColor={colors.t3}
              keyboardType="number-pad"
            />
            <PrimaryButton label={t('common.verify')} onPress={verify2FA} loading={loading} />
            <TouchableOpacity onPress={() => setIs2FARequired(false)} style={styles.cancelBtn}>
              <Text style={{ color: colors.red }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── FORGOT PASSWORD MODAL ──────────────── */}
      <Modal visible={showForgotModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg2 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.t1 }]}>Forgot Password?</Text>
              <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                <X size={24} color={colors.t1} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.t1 }]}
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder="Enter your email"
              placeholderTextColor={colors.t3}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <PrimaryButton label="Send Reset Link" onPress={handleForgotPassword} loading={resetting} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  header: { marginBottom: 32, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { fontSize: 14, marginTop: 8 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotText: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 8 },
  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  vehicleBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  vehicleLabel: { fontSize: 13, fontWeight: '600' },
  loginBtn: { marginTop: 12 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '85%', borderRadius: 20, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  hint: { fontSize: 13, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16 },
  cancelBtn: { marginTop: 16, alignItems: 'center' },
});