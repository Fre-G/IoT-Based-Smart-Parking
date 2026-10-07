import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, StatusBar, Modal, TextInput
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { C, R, Sh } from '../theme';
import { PrimaryButton, Pill, Loader } from '../components/UI';

const VEHICLE_TYPES = [
  { id: 'car', labelKey: 'vehicleTypes.car', icon: '🚗' },
  { id: 'motorcycle', labelKey: 'vehicleTypes.motorcycle', icon: '🏍️' },
  { id: 'truck', labelKey: 'vehicleTypes.truck', icon: '🚚' },
];

export default function VehiclesScreen({ navigation }) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState([]);
  const [defaultVehicleId, setDefaultVehicleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [form, setForm] = useState({ plate: '', color: '', type: 'car' });
  const user = auth.currentUser;

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setVehicles(data.vehicles || []);
        setDefaultVehicleId(data.defaultVehicleId || (data.vehicles?.length ? data.vehicles[0].id : null));
      }
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveVehicles = async (newVehicles, newDefaultId) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        vehicles: newVehicles,
        defaultVehicleId: newDefaultId,
      });
      setVehicles(newVehicles);
      setDefaultVehicleId(newDefaultId);
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  const addOrUpdateVehicle = () => {
    if (!form.plate || !form.color) {
      Alert.alert(t('errors.missingFields'), t('common.pleaseFill'));
      return;
    }
    let newVehicles = [...vehicles];
    if (editingVehicle) {
      const index = newVehicles.findIndex(v => v.id === editingVehicle.id);
      if (index !== -1) {
        newVehicles[index] = { ...editingVehicle, ...form };
      }
    } else {
      const newId = Date.now().toString();
      newVehicles.push({ id: newId, ...form });
      if (newVehicles.length === 1) setDefaultVehicleId(newId);
    }
    saveVehicles(newVehicles, defaultVehicleId);
    setModalVisible(false);
    setEditingVehicle(null);
    setForm({ plate: '', color: '', type: 'car' });
  };

  const deleteVehicle = (vehicle) => {
    Alert.alert(t('vehicles.delete'), t('vehicles.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vehicles.delete'),
        style: 'destructive',
        onPress: async () => {
          if (vehicle.id === defaultVehicleId) {
            Alert.alert(t('common.error'), t('vehicles.cannotDeleteDefault'));
            return;
          }
          const newVehicles = vehicles.filter(v => v.id !== vehicle.id);
          let newDefaultId = defaultVehicleId;
          if (newVehicles.length === 0) newDefaultId = null;
          await saveVehicles(newVehicles, newDefaultId);
        },
      },
    ]);
  };

  const setDefault = (vehicleId) => {
    saveVehicles(vehicles, vehicleId);
  };

  if (loading) return <Loader />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg0} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('vehicles.title')}</Text>
        <TouchableOpacity onPress={() => { setEditingVehicle(null); setForm({ plate: '', color: '', type: 'car' }); setModalVisible(true); }} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {vehicles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>🚗</Text>
          <Text style={styles.emptyTitle}>{t('vehicles.noVehicles')}</Text>
          <Text style={styles.emptyText}>{t('vehicles.addFirst')}</Text>
          <PrimaryButton label={t('vehicles.addVehicle')} onPress={() => { setEditingVehicle(null); setForm({ plate: '', color: '', type: 'car' }); setModalVisible(true); }} style={{ marginTop: 20 }} />
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.vehicleCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.plate}>{item.plate}</Text>
                <Pill label={t(`vehicleTypes.${item.type}`)} type="info" size="sm" />
              </View>
              <Text style={styles.color}>🎨 {item.color}</Text>
              <View style={styles.actions}>
                {defaultVehicleId === item.id && (
                  <View style={styles.defaultBadge}><Text style={styles.defaultText}>{t('vehicles.defaultVehicle')}</Text></View>
                )}
                {defaultVehicleId !== item.id && (
                  <TouchableOpacity onPress={() => setDefault(item.id)} style={styles.setDefaultBtn}>
                    <Text style={styles.setDefaultText}>{t('vehicles.setDefault')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { setEditingVehicle(item); setForm(item); setModalVisible(true); }} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteVehicle(item)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingVehicle ? t('vehicles.edit') : t('vehicles.addVehicle')}</Text>
            <TextInput style={styles.input} placeholder={t('vehicles.plate')} value={form.plate} onChangeText={text => setForm({ ...form, plate: text })} autoCapitalize="characters" />
            <TextInput style={styles.input} placeholder={t('vehicles.color')} value={form.color} onChangeText={text => setForm({ ...form, color: text })} autoCapitalize="words" />
            <View style={styles.typeRow}>
              {VEHICLE_TYPES.map(type => (
                <TouchableOpacity key={type.id} onPress={() => setForm({ ...form, type: type.id })} style={[styles.typeChip, form.type === type.id && styles.typeChipActive]}>
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text style={[styles.typeLabel, form.type === type.id && { color: C.teal }]}>{t(type.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelText}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={addOrUpdateVehicle} style={styles.saveBtn}><Text style={styles.saveText}>{t('vehicles.save')}</Text></TouchableOpacity>
            </View>
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
  addBtn: { width: 40, height: 40, borderRadius: R.md, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: C.inv, fontSize: 24, fontWeight: 'bold' },
  list: { padding: 20, paddingBottom: 36 },
  vehicleCard: { backgroundColor: C.bg2, borderRadius: R.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border, ...Sh.soft },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  plate: { fontSize: 18, fontWeight: '800', color: C.t1 },
  color: { fontSize: 14, color: C.t2, marginBottom: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  defaultBadge: { backgroundColor: C.tealBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full },
  defaultText: { color: C.teal, fontSize: 11, fontWeight: '700' },
  setDefaultBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  setDefaultText: { color: C.teal, fontSize: 12, fontWeight: '600' },
  editBtn: { padding: 6 },
  editBtnText: { fontSize: 18 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 18 },
  empty: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: C.t1, marginTop: 14, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.t2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: C.bg2, borderRadius: R.xl, padding: 20, width: '85%', borderWidth: 1, borderColor: C.border },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.t1, marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: C.bg1, borderRadius: R.md, padding: 12, fontSize: 16, color: C.t1, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: R.md, backgroundColor: C.bg1, borderWidth: 1, borderColor: C.border },
  typeChipActive: { borderColor: C.teal, backgroundColor: C.tealBg },
  typeIcon: { fontSize: 20 },
  typeLabel: { fontSize: 12, color: C.t2, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: R.md, backgroundColor: C.bg1, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  cancelText: { color: C.t2, fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: R.md, backgroundColor: C.teal, alignItems: 'center' },
  saveText: { color: C.inv, fontWeight: '700' },
});