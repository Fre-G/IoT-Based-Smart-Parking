import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, StatusBar, Image, Modal, TextInput
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { 
  User, Car, MapPin, Bell, LogOut, AlertTriangle, Globe, Moon, Sun, 
  Edit2, Save, X, Trash2, History, Shield, HelpCircle, MessageCircle
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { PrimaryButton, Loader } from '../components/UI';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const { colors, isDark, toggleTheme } = useTheme();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    vehiclePlate: '',
    vehicleColor: '',
  });
  const [saving, setSaving] = useState(false);
  
  const user = auth.currentUser;

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('authUid', '==', user.uid));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        const data = userDoc.data();
        setUserData(data);
        setProfilePhoto(data.profilePhoto || null);
        setEditForm({
          fullName: data.fullName || '',
          phone: data.phone || '',
          vehiclePlate: data.vehiclePlate || '',
          vehicleColor: data.vehicleColor || '',
        });
      }
      setLoading(false);
    };
    fetchUserData();
  }, [user]);

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setUploading(true);
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('authUid', '==', user.uid));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const userDocId = querySnap.docs[0].id;
          await updateDoc(doc(db, 'users', userDocId), { profilePhoto: base64 });
          setProfilePhoto(base64);
          Alert.alert('Success', 'Profile photo updated');
        } else {
          Alert.alert('Error', 'User profile not found');
        }
      } catch (e) {
        Alert.alert('Error', e.message);
      } finally {
        setUploading(false);
      }
    }
  };

  const sendReport = async () => {
    if (!reportMessage.trim()) {
      Alert.alert('Empty', 'Please describe the issue.');
      return;
    }
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('authUid', '==', user.uid));
      const querySnap = await getDocs(q);
      let username = 'Unknown';
      if (!querySnap.empty) username = querySnap.docs[0].id;
      
      await addDoc(collection(db, 'supportTickets'), {
        userId: user.uid,
        username: username,
        driverName: userData?.fullName || 'Unknown',
        email: user.email,
        message: reportMessage,
        status: 'open',
        timestamp: new Date().toISOString()
      });
      Alert.alert('Sent', 'Your report has been sent.');
      setReportMessage('');
      setShowReportModal(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'am' : 'en';
    i18n.changeLanguage(newLang);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: async () => { await auth.signOut(); navigation.replace('Login'); } }
    ]);
  };

  const deleteAccount = async () => {
    setShowDeleteConfirm(false);
    Alert.alert(
      '⚠️ Delete Account',
      'This will permanently delete your account, all your booking history, and personal data. This action cannot be undone.\n\nAre you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('authUid', '==', user.uid));
              const querySnap = await getDocs(q);
              if (!querySnap.empty) {
                const userDocId = querySnap.docs[0].id;
                const sessionsQuery = query(collection(db, 'parkingSessions'), where('userId', '==', user.uid));
                const sessionsSnap = await getDocs(sessionsQuery);
                for (const sessionDoc of sessionsSnap.docs) {
                  await deleteDoc(doc(db, 'parkingSessions', sessionDoc.id));
                }
                await deleteDoc(doc(db, 'users', userDocId));
              }
              await deleteUser(user);
              navigation.replace('Login');
            } catch (error) {
              console.error('Delete account error:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again later.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const saveProfile = async () => {
    if (!editForm.fullName.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }
    setSaving(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('authUid', '==', user.uid));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const userDocId = querySnap.docs[0].id;
        await updateDoc(doc(db, 'users', userDocId), {
          fullName: editForm.fullName,
          phone: editForm.phone,
          vehiclePlate: editForm.vehiclePlate,
          vehicleColor: editForm.vehicleColor,
        });
        setUserData(prev => ({ ...prev, ...editForm }));
        Alert.alert('Success', 'Profile updated successfully');
        setShowEditModal(false);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Profile Header with Photo */}
        <TouchableOpacity onPress={pickProfilePhoto} disabled={uploading} style={styles.avatarWrapper}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.bg2 }]}>
              <User size={60} color={colors.t1} />
            </View>
          )}
          <Text style={[styles.editPhotoText, { color: colors.teal }]}>{uploading ? 'Uploading...' : 'Change photo'}</Text>
        </TouchableOpacity>

        <Text style={[styles.name, { color: colors.t1 }]}>{userData?.fullName || 'Driver'}</Text>
        <Text style={[styles.email, { color: colors.t2 }]}>{user?.email}</Text>

        {/* Edit Profile Button */}
        <TouchableOpacity 
          style={[styles.editProfileBtn, { backgroundColor: colors.teal + '20', borderColor: colors.teal }]} 
          onPress={() => setShowEditModal(true)}
        >
          <Edit2 size={16} color={colors.teal} />
          <Text style={[styles.editProfileText, { color: colors.teal }]}>Edit Profile</Text>
        </TouchableOpacity>

        {/* Vehicle Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Car size={20} color={colors.teal} />
            <Text style={[styles.infoText, { color: colors.t1 }]}>{userData?.vehiclePlate || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={20} color={colors.teal} />
            <Text style={[styles.infoText, { color: colors.t1 }]}>{userData?.vehicleType || 'car'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Bell size={20} color={colors.teal} />
            <Text style={[styles.infoText, { color: colors.t1 }]}>{userData?.phone || 'Not set'}</Text>
          </View>
        </View>

        {/* Menu Items - ONLY WORKING SCREENS */}
        <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.bg2, borderColor: colors.border }]} onPress={() => navigation.navigate('Vehicles')}>
          <Car size={20} color={colors.t1} />
          <Text style={[styles.menuText, { color: colors.t1 }]}>My Vehicles</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.bg2, borderColor: colors.border }]} onPress={() => navigation.navigate('ParkingHistory')}>
          <History size={20} color={colors.t1} />
          <Text style={[styles.menuText, { color: colors.t1 }]}>Parking History</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.bg2, borderColor: colors.border }]} onPress={() => navigation.navigate('Notifications')}>
          <Bell size={20} color={colors.t1} />
          <Text style={[styles.menuText, { color: colors.t1 }]}>Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.bg2, borderColor: colors.border }]} onPress={toggleLanguage}>
          <Globe size={20} color={colors.t1} />
          <Text style={[styles.menuText, { color: colors.t1 }]}>Language ({i18n.language === 'en' ? 'Amharic' : 'English'})</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.bg2, borderColor: colors.border }]} onPress={toggleTheme}>
          {isDark ? <Sun size={20} color={colors.t1} /> : <Moon size={20} color={colors.t1} />}
          <Text style={[styles.menuText, { color: colors.t1 }]}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.bg2, borderColor: colors.border }]} onPress={() => navigation.navigate('PrivacySecurity')}>
          <Shield size={20} color={colors.t1} />
          <Text style={[styles.menuText, { color: colors.t1 }]}>Privacy & Security</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.bg2, borderColor: colors.border }]} onPress={() => navigation.navigate('HelpSupport')}>
          <HelpCircle size={20} color={colors.t1} />
          <Text style={[styles.menuText, { color: colors.t1 }]}>Help & Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.bg2, borderColor: colors.border }]} onPress={() => setShowReportModal(true)}>
          <MessageCircle size={20} color={colors.red} />
          <Text style={[styles.menuText, { color: colors.t1 }]}>Report Issue</Text>
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity 
          style={[styles.menuItem, { backgroundColor: colors.bg2, borderColor: colors.red, marginTop: 10 }]} 
          onPress={() => setShowDeleteConfirm(true)}
        >
          <Trash2 size={20} color={colors.red} />
          <Text style={[styles.menuText, { color: colors.red }]}>Delete Account</Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <PrimaryButton label="Logout" onPress={handleLogout} style={styles.logoutBtn} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg1 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.t1 }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <X size={24} color={colors.t1} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.bg2, borderColor: colors.border, color: colors.t1 }]}
              placeholder="Full Name"
              placeholderTextColor={colors.t3}
              value={editForm.fullName}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, fullName: text }))}
            />
            
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.bg2, borderColor: colors.border, color: colors.t1 }]}
              placeholder="Phone Number"
              placeholderTextColor={colors.t3}
              value={editForm.phone}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.bg2, borderColor: colors.border, color: colors.t1 }]}
              placeholder="Vehicle Plate"
              placeholderTextColor={colors.t3}
              value={editForm.vehiclePlate}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, vehiclePlate: text.toUpperCase() }))}
              autoCapitalize="characters"
            />
            
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.bg2, borderColor: colors.border, color: colors.t1 }]}
              placeholder="Vehicle Color"
              placeholderTextColor={colors.t3}
              value={editForm.vehicleColor}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, vehicleColor: text }))}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={[styles.modalCancel, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <Text style={{ color: colors.t2 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveProfile} disabled={saving} style={[styles.modalSave, { backgroundColor: colors.teal }]}>
                <Save size={18} color="#060B18" />
                <Text style={{ color: '#060B18', fontWeight: 'bold' }}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Issue Modal */}
      <Modal visible={showReportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg1 }]}>
            <Text style={[styles.modalTitle, { color: colors.t1 }]}>Report an issue</Text>
            <TextInput
              style={[styles.reportInput, { borderColor: colors.border, color: colors.t1, backgroundColor: colors.bg2 }]}
              multiline
              numberOfLines={4}
              placeholder="Describe what happened..."
              placeholderTextColor={colors.t3}
              value={reportMessage}
              onChangeText={setReportMessage}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowReportModal(false)} style={[styles.modalCancel, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <Text style={{ color: colors.t2 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={sendReport} style={[styles.modalSave, { backgroundColor: colors.teal }]}>
                <Text style={{ color: '#060B18', fontWeight: 'bold' }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: colors.bg1 }]}>
            <Trash2 size={48} color={colors.red} />
            <Text style={[styles.confirmTitle, { color: colors.t1 }]}>Delete Account?</Text>
            <Text style={[styles.confirmText, { color: colors.t2 }]}>
              This will permanently delete your account, all booking history, and personal data. This action cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity onPress={() => setShowDeleteConfirm(false)} style={[styles.confirmCancel, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <Text style={{ color: colors.t2 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={deleteAccount} style={[styles.confirmDelete, { backgroundColor: colors.red }]}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { alignItems: 'center', padding: 24, paddingBottom: 40 },
  avatarWrapper: { alignItems: 'center', marginBottom: 16 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  editPhotoText: { fontSize: 12, marginTop: 4 },
  name: { fontSize: 24, fontWeight: '900', marginBottom: 4 },
  email: { fontSize: 14, marginBottom: 20 },
  
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  editProfileText: { fontSize: 14, fontWeight: '600' },
  infoCard: { borderRadius: 16, padding: 16, width: '100%', marginBottom: 24, borderWidth: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  infoText: { fontSize: 14, fontWeight: '500' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 16, width: '100%', marginBottom: 12, borderWidth: 1 },
  menuText: { fontSize: 14, fontWeight: '600' },
  logoutBtn: { marginTop: 20, width: '100%' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: 24, padding: 20, width: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  editInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12 },
  reportInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1 },
  modalSave: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  
  confirmModal: { borderRadius: 24, padding: 24, width: '85%', alignItems: 'center' },
  confirmTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  confirmText: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  confirmDelete: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
});