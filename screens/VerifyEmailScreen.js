import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, StatusBar, ScrollView, Switch, Modal, TextInput
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { C, R, Sh } from '../theme';
import { PrimaryButton, InputField } from '../components/UI';

export default function PrivacySecurityScreen({ navigation }) {
  const { t } = useTranslation();
  const user = auth.currentUser;
  const [loading, setLoading] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showBiometricPasswordModal, setShowBiometricPasswordModal] = useState(false);
  const [biometricPassword, setBiometricPassword] = useState('');
  const [dataSharing, setDataSharing] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorHint, setTwoFactorHint] = useState('');
  const [twoFactorModalVisible, setTwoFactorModalVisible] = useState(false);
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [twoFactorConfirm, setTwoFactorConfirm] = useState('');
  const [twoFactorHintText, setTwoFactorHintText] = useState('');
  const [disable2FAModal, setDisable2FAModal] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');

  useEffect(() => {
    loadSettings();
    checkBiometricSupport();
    load2FAStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const dataSharingVal = await AsyncStorage.getItem('privacy_dataSharing');
      if (dataSharingVal !== null) setDataSharing(dataSharingVal === 'true');
      const biometricVal = await AsyncStorage.getItem('privacy_biometric');
      if (biometricVal !== null) setBiometricEnabled(biometricVal === 'true');
      const alertsVal = await AsyncStorage.getItem('privacy_securityAlerts');
      if (alertsVal !== null) setSecurityAlerts(alertsVal === 'true');
    } catch (error) {}
  };

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricSupported(compatible && enrolled);
    if (!compatible && biometricEnabled) {
      await SecureStore.deleteItemAsync('biometric_email');
      await SecureStore.deleteItemAsync('biometric_password');
      await AsyncStorage.setItem('privacy_biometric', 'false');
      setBiometricEnabled(false);
    }
  };

  const load2FAStatus = async () => {
    if (!user) return;
    const docSnap = await getDoc(doc(db, 'users', user.uid));
    if (docSnap.exists()) {
      setTwoFactorEnabled(!!docSnap.data()?.twoFactorEnabled);
      setTwoFactorHint(docSnap.data()?.twoFactorHint || '');
    }
  };

  const saveSetting = async (key, value) => {
    await AsyncStorage.setItem(key, value.toString());
  };

  const handleBiometricToggle = async (value) => {
    if (value && !biometricSupported) {
      Alert.alert(t('privacySecurity.biometricNotAvailable'), t('privacySecurity.biometricNotAvailableMsg'));
      return;
    }
    if (value) {
      setShowBiometricPasswordModal(true);
    } else {
      await SecureStore.deleteItemAsync('biometric_email');
      await SecureStore.deleteItemAsync('biometric_password');
      setBiometricEnabled(false);
      await saveSetting('privacy_biometric', false);
      Alert.alert(t('common.success'), t('privacySecurity.biometricDisabledMsg'));
    }
  };

  const verifyAndEnableBiometric = async () => {
    if (!biometricPassword) {
      Alert.alert(t('common.error'), t('common.pleaseFill'));
      return;
    }
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const email = userDoc.data()?.email;
      if (!email) throw new Error('No email found');
      await auth.signInWithEmailAndPassword(email, biometricPassword);
      await SecureStore.setItemAsync('biometric_email', email);
      await SecureStore.setItemAsync('biometric_password', biometricPassword);
      setBiometricEnabled(true);
      await saveSetting('privacy_biometric', true);
      Alert.alert(t('common.success'), t('privacySecurity.biometricEnabledMsg'));
      setShowBiometricPasswordModal(false);
      setBiometricPassword('');
    } catch (error) {
      Alert.alert(t('common.error'), t('privacySecurity.wrongCurrentPassword'));
    } finally {
      setLoading(false);
    }
  };

  const hashPassword = async (password) => {
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
  };

  const open2FAModal = () => {
    if (twoFactorEnabled) {
      setDisable2FAModal(true);
    } else {
      setTwoFactorPassword('');
      setTwoFactorConfirm('');
      setTwoFactorHintText('');
      setTwoFactorModalVisible(true);
    }
  };

  const enable2FA = async () => {
    const pwd = twoFactorPassword || '';
    const confirm = twoFactorConfirm || '';
    const hint = twoFactorHintText || '';

    if (!pwd) {
      Alert.alert(t('common.error'), t('privacySecurity.enter2FAPassword'));
      return;
    }
    if (pwd.length < 4) {
      Alert.alert(t('common.error'), t('privacySecurity.passwordTooShort'));
      return;
    }
    if (pwd !== confirm) {
      Alert.alert(t('common.error'), t('privacySecurity.passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      const hashed = await hashPassword(pwd);
      await updateDoc(doc(db, 'users', user.uid), {
        twoFactorEnabled: true,
        twoFactorPassword: hashed,
        twoFactorHint: hint.trim(),
      });
      setTwoFactorEnabled(true);
      setTwoFactorHint(hint);
      Alert.alert(t('common.success'), t('privacySecurity.twoFactorEnabledMsg'));
      setTwoFactorModalVisible(false);
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    const pwd = disable2FAPassword || '';
    if (!pwd) {
      Alert.alert(t('common.error'), t('common.pleaseFill'));
      return;
    }
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const storedHash = userDoc.data()?.twoFactorPassword;
      const inputHash = await hashPassword(pwd);
      if (!storedHash || inputHash !== storedHash) {
        Alert.alert(t('common.error'), t('privacySecurity.wrong2FAPassword'));
        return;
      }
      await updateDoc(doc(db, 'users', user.uid), {
        twoFactorEnabled: false,
        twoFactorPassword: null,
        twoFactorHint: null,
      });
      setTwoFactorEnabled(false);
      setTwoFactorHint('');
      Alert.alert(t('common.success'), t('privacySecurity.twoFactorDisabledMsg'));
      setDisable2FAModal(false);
      setDisable2FAPassword('');
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationAccess = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') Alert.alert(t('common.success'), t('privacySecurity.locationGranted'));
    else Alert.alert(t('common.error'), t('privacySecurity.locationDenied'));
  };

  const handleDataSharing = async (val) => {
    setDataSharing(val);
    await saveSetting('privacy_dataSharing', val);
  };

  const handleSecurityAlerts = async (val) => {
    setSecurityAlerts(val);
    await saveSetting('privacy_securityAlerts', val);
    if (val) Alert.alert(t('common.success'), t('privacySecurity.securityAlertsEnabled'));
  };

  const menuItems = [
    { key: 'privacyPolicy', label: t('privacySecurity.privacyPolicy'), icon: '📄', onPress: () => setPrivacyModalVisible(true), type: 'action' },
    { key: 'dataSharing', label: t('privacySecurity.dataSharing'), icon: '📊', type: 'toggle', value: dataSharing, onToggle: handleDataSharing, sub: t('privacySecurity.dataSharingDesc') },
    { key: 'locationAccess', label: t('privacySecurity.locationAccess'), icon: '📍', type: 'action', onPress: handleLocationAccess, sub: t('privacySecurity.locationAccessDesc') },
    { key: 'biometricLogin', label: t('privacySecurity.biometricLogin'), icon: '🔒', type: 'toggle', value: biometricEnabled, onToggle: handleBiometricToggle, sub: biometricSupported ? t('privacySecurity.biometricSupported') : t('privacySecurity.biometricNotSupported'), disabled: !biometricSupported },
    { key: 'twoFactor', label: t('privacySecurity.twoFactor'), icon: '🔐', type: 'action', onPress: open2FAModal, sub: twoFactorEnabled ? `${t('privacySecurity.twoFactorEnabled')}${twoFactorHint ? ` (${t('privacySecurity.hint')}: ${twoFactorHint})` : ''}` : t('privacySecurity.twoFactorDisabled') },
    { key: 'securityAlerts', label: t('privacySecurity.securityAlerts'), icon: '⚠️', type: 'toggle', value: securityAlerts, onToggle: handleSecurityAlerts, sub: t('privacySecurity.securityAlertsDesc') },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg0} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Text style={styles.backArrow}>←</Text></TouchableOpacity>
        <Text style={styles.title}>{t('privacySecurity.title')}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {menuItems.map((item) => (
          <View key={item.key} style={styles.menuItem}>
            <View style={styles.menuIcon}><Text style={{ fontSize: 22 }}>{item.icon}</Text></View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.sub && <Text style={styles.menuSub}>{item.sub}</Text>}
            </View>
            {item.type === 'toggle' ? (
              <Switch value={item.value} onValueChange={item.onToggle} trackColor={{ false: C.bg3, true: C.teal }} thumbColor={C.inv} disabled={item.disabled} />
            ) : (
              <TouchableOpacity onPress={item.onPress} style={styles.actionButton}><Text style={styles.arrow}>›</Text></TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={twoFactorModalVisible} animationType="slide" transparent onRequestClose={() => setTwoFactorModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('privacySecurity.set2FAPassword')}</Text>
            <TextInput style={styles.input} placeholder={t('privacySecurity.enter2FAPassword')} secureTextEntry value={twoFactorPassword} onChangeText={setTwoFactorPassword} />
            <TextInput style={styles.input} placeholder={t('privacySecurity.confirm2FAPassword')} secureTextEntry value={twoFactorConfirm} onChangeText={setTwoFactorConfirm} />
            <TextInput style={styles.input} placeholder={t('privacySecurity.enterHint')} value={twoFactorHintText} onChangeText={setTwoFactorHintText} />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setTwoFactorModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelText}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={enable2FA} style={styles.saveBtn} disabled={loading}><Text style={styles.saveText}>{loading ? t('common.loading') : t('privacySecurity.enable')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={disable2FAModal} animationType="slide" transparent onRequestClose={() => setDisable2FAModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('privacySecurity.disable2FA')}</Text>
            <TextInput style={styles.input} placeholder={t('privacySecurity.enter2FAPassword')} secureTextEntry value={disable2FAPassword} onChangeText={setDisable2FAPassword} />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setDisable2FAModal(false)} style={styles.cancelBtn}><Text style={styles.cancelText}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={disable2FA} style={styles.dangerBtn} disabled={loading}><Text style={styles.saveText}>{loading ? t('common.loading') : t('privacySecurity.disable')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBiometricPasswordModal} animationType="slide" transparent onRequestClose={() => setShowBiometricPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('privacySecurity.enableBiometric')}</Text>
            <Text style={styles.modalSubText}>{t('privacySecurity.enterPasswordToStore')}</Text>
            <InputField icon="🔐" placeholder={t('login.password')} secureTextEntry value={biometricPassword} onChangeText={setBiometricPassword} />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowBiometricPasswordModal(false)} style={styles.cancelBtn}><Text style={styles.cancelText}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={verifyAndEnableBiometric} style={styles.saveBtn} disabled={loading}><Text style={styles.saveText}>{loading ? t('common.loading') : t('common.enable')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={privacyModalVisible} animationType="slide" transparent onRequestClose={() => setPrivacyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('privacySecurity.privacyPolicy')}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={styles.privacyText}>{t('privacySecurity.privacyPolicyText')}</Text>
            </ScrollView>
            <PrimaryButton label={t('common.ok')} onPress={() => setPrivacyModalVisible(false)} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, borderRadius: R.md, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backArrow: { color: C.t1, fontSize: 20 },
  title: { fontSize: 24, fontWeight: '900', color: C.t1, letterSpacing: -0.5 },
  scroll: { padding: 20, paddingBottom: 40 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg2, borderRadius: R.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, ...Sh.soft },
  menuIcon: { width: 48, height: 48, borderRadius: R.md, backgroundColor: C.bg1, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 16, fontWeight: '700', color: C.t1 },
  menuSub: { fontSize: 12, color: C.t3, marginTop: 4 },
  actionButton: { paddingHorizontal: 12 },
  arrow: { fontSize: 20, color: C.t3, fontWeight: '300' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: C.bg2, borderRadius: R.xl, padding: 20, width: '85%', borderWidth: 1, borderColor: C.border },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.t1, marginBottom: 12, textAlign: 'center' },
  modalSubText: { fontSize: 14, color: C.t2, textAlign: 'center', marginBottom: 16 },
  input: { backgroundColor: C.bg1, borderRadius: R.md, padding: 14, fontSize: 16, color: C.t1, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: R.md, backgroundColor: C.bg1, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  cancelText: { color: C.t2, fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: R.md, backgroundColor: C.teal, alignItems: 'center' },
  dangerBtn: { flex: 1, paddingVertical: 12, borderRadius: R.md, backgroundColor: C.red, alignItems: 'center' },
  saveText: { color: C.inv, fontWeight: '700' },
  privacyText: { fontSize: 14, color: C.t2, lineHeight: 20 },
});