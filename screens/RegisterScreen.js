import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Image, Modal, TextInput, ActivityIndicator
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, User, Mail, Phone, Lock, Car, Bike, Truck, Hash, Palette, Camera, CheckCircle, Eye, EyeOff, MailCheck } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { signInWithCredential, GoogleAuthProvider, sendEmailVerification, applyActionCode } from 'firebase/auth';
import { C, R, Sh } from '../theme';
import { PrimaryButton, InputField, Loader } from '../components/UI';
import { useTheme } from '../context/ThemeContext';

WebBrowser.maybeCompleteAuthSession();

const VEHICLE_TYPES = [
  { id: 'car', labelKey: 'vehicleTypes.car', icon: Car },
  { id: 'motorcycle', labelKey: 'vehicleTypes.motorcycle', icon: Bike },
  { id: 'truck', labelKey: 'vehicleTypes.truck', icon: Truck },
];


const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidEthiopianPhone = (phone) => {
  const phoneRegex = /^\+251[0-9]{9}$/;
  return phoneRegex.test(phone);
};

const formatPhoneNumber = (text) => {
  let cleaned = text.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
    return `+251${cleaned}`;
  }
  if (!cleaned.startsWith('251') && cleaned.length > 0 && !cleaned.startsWith('+')) {
    return `+251${cleaned}`;
  }
  if (cleaned.startsWith('251')) {
    return `+${cleaned}`;
  }
  return text;
};

export default function RegisterScreen({ navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [licenseImageBase64, setLicenseImageBase64] = useState(null);
  const [licensePreviewUri, setLicensePreviewUri] = useState(null);
  
 
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [tempUserCredential, setTempUserCredential] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [verificationError, setVerificationError] = useState('');

  const [form, setForm] = useState({
    username: '', firstName: '', lastName: '', email: '', password: '', phone: '',
    plate: '', vehicleColor: '', vehicleType: 'car',
  });


  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Replace with your Web Client ID
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com', // Replace with your Android Client ID
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com', // Replace with your iOS Client ID
  });

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSignIn(response);
    } else if (response?.type === 'error') {
      console.log('Google Sign-In error:', response.error);
      Alert.alert('Sign In Failed', 'Google Sign-In failed. Please try again or use email sign up.');
    }
  }, [response]);

  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleGoogleSignIn = async (response) => {
    setLoading(true);
    try {
      const { authentication } = response;
      const credential = GoogleAuthProvider.credential(
        authentication.idToken,
        authentication.accessToken
      );
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;
      
      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('authUid', '==', user.uid));
      const querySnap = await getDocs(q);
      
      let username = user.email?.split('@')[0] || 'user';
      let existingUser = false;
      
      if (!querySnap.empty) {
        existingUser = true;
        const userData = querySnap.docs[0].data();
        username = userData.username || username;
      }
      
      if (!existingUser) {
       
        const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
        const usernameSnap = await getDocs(usernameQuery);
        if (!usernameSnap.empty) {
          username = `${username}_${Math.floor(Math.random() * 1000)}`;
        }
        
       
        await setDoc(doc(db, 'users', username), {
          authUid: user.uid,
          username: username,
          fullName: user.displayName || '',
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ')[1] || '',
          email: user.email,
          phone: '',
          vehicles: [],
          vehiclePlate: '',
          vehicleType: 'car',
          vehicleColor: '',
          role: 'driver',
          driversLicenseBase64: '',
          licenseVerificationStatus: 'pending',
          emailVerified: user.emailVerified,
          createdAt: new Date().toISOString(),
        });
      }
      
      if (!user.emailVerified) {
        await sendEmailVerification(user);
        Alert.alert('Email Verification', 'Verification email sent. Please verify your email before continuing.');
      }
      
      navigation.replace('Main');
    } catch (error) {
      console.error('Google sign-in error:', error);
      Alert.alert('Sign In Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = useCallback((key) => (value) => {
    if (key === 'phone') {
      value = formatPhoneNumber(value);
    }
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  // Actually send verification email using Firebase
  const sendVerificationEmail = async (user) => {
    try {
      await sendEmailVerification(user);
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  };

  const nextStep = async () => {
   
    if (!form.username || !form.firstName || !form.lastName || !form.email || !form.phone || !form.password) {
      Alert.alert(t('errors.missingFields'), t('common.pleaseFill'));
      return;
    }
    
    
    if (!isValidEmail(form.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address (e.g., name@example.com)');
      return;
    }
    
   
    if (!isValidEthiopianPhone(form.phone)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid Ethiopian phone number in format +251912345678');
      return;
    }
    
    if (form.password.length < 6) {
      Alert.alert(t('errors.weakPassword'), t('common.minLength', { length: 6 }));
      return;
    }
    
    setLoading(true);
    try {
      
      const q = query(collection(db, 'users'), where('username', '==', form.username));
      const snap = await getDocs(q);
      if (!snap.empty) {
        Alert.alert(t('register.usernameTaken'), t('register.usernameTakenMsg'));
        setLoading(false);
        return;
      }
      
      
      const emailQuery = query(collection(db, 'users'), where('email', '==', form.email));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) {
        Alert.alert('Email Taken', 'This email is already registered. Please use a different email or login.');
        setLoading(false);
        return;
      }
      
      
      const cred = await auth.createUserWithEmailAndPassword(form.email, form.password);
      setTempUserCredential(cred);
      
      
      const emailSent = await sendVerificationEmail(cred.user);
      
      if (emailSent) {
        Alert.alert(
          'Verification Email Sent',
          `We've sent a verification link to ${form.email}. Please check your inbox and click the link to verify your email.\n\nAfter verification, click OK to continue.`,
          [
            { 
              text: 'OK', 
              onPress: () => {
                setShowVerificationModal(true);
                
                checkEmailVerified(cred.user);
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to send verification email. Please try again.');
        setLoading(false);
      }
      
    } catch (e) {
      let msg = e.message;
      if (msg.includes('email-already-in-use')) msg = t('errors.emailInUse');
      Alert.alert(t('common.error'), msg);
      setLoading(false);
    }
  };

  
  const checkEmailVerified = async (user) => {
    const interval = setInterval(async () => {
      await user.reload();
      if (user.emailVerified) {
        clearInterval(interval);
        setVerificationError('');
        setStep(2);
        setShowVerificationModal(false);
        Alert.alert('Email Verified', 'Your email has been verified! Please complete your profile.');
        setLoading(false);
      }
    }, 3000); 
    
   
    setTimeout(() => {
      clearInterval(interval);
      if (!user.emailVerified) {
        setVerificationError('Verification not detected yet. Please check your email and click the verification link.');
        setLoading(false);
      }
    }, 300000);
  };

  const resendVerificationEmail = async () => {
    if (resendTimer > 0 || !tempUserCredential?.user) return;
    
    setResendTimer(60);
    const success = await sendVerificationEmail(tempUserCredential.user);
    if (success) {
      Alert.alert('Email Sent', `Verification email resent to ${form.email}`);
    } else {
      Alert.alert('Error', 'Failed to send verification email. Please try again.');
    }
  };

  const skipToStep2 = () => {
    if (tempUserCredential?.user?.emailVerified) {
      setStep(2);
      setShowVerificationModal(false);
    } else {
      Alert.alert('Not Verified', 'Please verify your email first. Check your inbox for the verification link.');
    }
  };

  const pickLicenseImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Needed", "Please allow access to your photo library.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setLicensePreviewUri(asset.uri);
        if (asset.base64) {
          setLicenseImageBase64(`data:image/jpeg;base64,${asset.base64}`);
        }
      }
    } catch (err) {
      Alert.alert("Image Error", "Could not process the image. Try another photo.");
    }
  };

  const handleRegister = async () => {
    if (!form.plate || !form.vehicleColor) {
      Alert.alert(t('errors.missingFields'), t('common.vehicleRequired'));
      return;
    }
    if (!licenseImageBase64) {
      Alert.alert("Document Missing", "Please select a photo of your driving license.");
      return;
    }
    setLoading(true);
    try {
      const fullName = `${form.firstName} ${form.lastName}`;
      const user = tempUserCredential.user;
      
      await setDoc(doc(db, 'users', form.username), {
        authUid: user.uid,
        username: form.username,
        fullName,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        vehicles: [],
        vehiclePlate: form.plate,
        vehicleType: form.vehicleType,
        vehicleColor: form.vehicleColor,
        role: 'driver',
        driversLicenseBase64: licenseImageBase64,
        licenseVerificationStatus: 'pending',
        emailVerified: user.emailVerified,
        createdAt: new Date().toISOString(),
      });
      
      Alert.alert(t('register.successTitle'), 'Registration successful! Please log in.', [
        { text: t('register.signIn'), onPress: () => navigation.navigate('Login') }
      ]);
    } catch (e) {
      let msg = e.message;
      if (msg.includes('email-already-in-use')) msg = t('errors.emailInUse');
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;

  const VehicleIcon = ({ type, size = 24 }) => {
    const Icon = VEHICLE_TYPES.find(v => v.id === type)?.icon || Car;
    return <Icon size={size} color={colors.t1} />;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => step === 2 ? setStep(1) : navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
              <ArrowLeft size={20} color={colors.t1} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.title, { color: colors.t1 }]}>{t('register.title')}</Text>
              <Text style={[styles.sub, { color: colors.t2 }]}>
                Step {step} of 2 • {step === 1 ? t('register.personalInfo') : t('register.vehicleDetails')}
              </Text>
            </View>
          </View>
          <View style={styles.stepBar}>
            <View style={[styles.stepFill, { width: step === 1 ? '50%' : '100%', backgroundColor: colors.teal }]} />
          </View>
          <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <View style={[styles.cardTop, { backgroundColor: colors.teal }]} />
            {step === 1 ? (
              <View style={styles.fields}>
                <Text style={[styles.fieldGroup, { color: colors.t3 }]}>{t('register.personalInfo')}</Text>
                <InputField icon={<User size={18} color={colors.t3} />} placeholder="Username" value={form.username} onChangeText={updateField('username')} autoCapitalize="none" />
                <InputField icon={<User size={18} color={colors.t3} />} placeholder="First Name" value={form.firstName} onChangeText={updateField('firstName')} autoCapitalize="words" />
                <InputField icon={<User size={18} color={colors.t3} />} placeholder="Last Name" value={form.lastName} onChangeText={updateField('lastName')} autoCapitalize="words" />
                <InputField icon={<Mail size={18} color={colors.t3} />} placeholder="Email" value={form.email} onChangeText={updateField('email')} keyboardType="email-address" />
                <InputField icon={<Phone size={18} color={colors.t3} />} placeholder="Phone (+251912345678)" value={form.phone} onChangeText={updateField('phone')} keyboardType="phone-pad" />
                <InputField
                  icon={<Lock size={18} color={colors.t3} />}
                  placeholder="Password (min 6 characters)"
                  value={form.password}
                  onChangeText={updateField('password')}
                  secureTextEntry={!showPassword}
                  toggleSecure={() => setShowPassword(prev => !prev)}
                  rightIcon={showPassword ? <EyeOff size={18} color={colors.t3} /> : <Eye size={18} color={colors.t3} />}
                />
                <PrimaryButton label={t('register.continue')} onPress={nextStep} />
                
                <View style={styles.divRow}>
                  <View style={[styles.divLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.divText, { color: colors.t3 }]}>or</Text>
                  <View style={[styles.divLine, { backgroundColor: colors.border }]} />
                </View>
                
                <TouchableOpacity 
                  style={[styles.googleButton, { backgroundColor: colors.bg1, borderColor: colors.border }]}
                  onPress={() => promptAsync()}
                  disabled={!request}
                >
                  <Text style={[styles.googleButtonText, { color: colors.t1 }]}>Continue with Google</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.fields}>
                <Text style={[styles.fieldGroup, { color: colors.t3 }]}>{t('register.vehicleDetails')}</Text>
                <View style={styles.vtRow}>
                  {VEHICLE_TYPES.map(vt => {
                    const Icon = vt.icon;
                    return (
                      <TouchableOpacity
                        key={vt.id}
                        onPress={() => updateField('vehicleType')(vt.id)}
                        style={[styles.vtChip, { backgroundColor: colors.bg1, borderColor: colors.border }, form.vehicleType === vt.id && styles.vtChipActive]}
                      >
                        <Icon size={20} color={form.vehicleType === vt.id ? colors.teal : colors.t2} />
                        <Text style={[styles.vtLabel, { color: colors.t2 }, form.vehicleType === vt.id && { color: colors.teal }]}>{t(vt.labelKey)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <InputField icon={<Hash size={18} color={colors.t3} />} placeholder="Vehicle Plate" value={form.plate} onChangeText={updateField('plate')} autoCapitalize="characters" />
                <InputField icon={<Palette size={18} color={colors.t3} />} placeholder="Vehicle Color" value={form.vehicleColor} onChangeText={updateField('vehicleColor')} autoCapitalize="words" />
                
                <Text style={[styles.fieldGroup, { color: colors.t3 }]}>Driving License</Text>
                <TouchableOpacity onPress={pickLicenseImage} style={styles.licensePicker}>
                  {licensePreviewUri ? (
                    <Image source={{ uri: licensePreviewUri }} style={styles.licensePreview} />
                  ) : (
                    <View style={[styles.licensePlaceholder, { backgroundColor: colors.bg1, borderColor: colors.border }]}>
                      <Camera size={36} color={colors.t3} />
                      <Text style={[styles.licensePlaceholderText, { color: colors.t2 }]}>Tap to select license photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {licenseImageBase64 && (
                  <View style={styles.licenseHint}>
                    <CheckCircle size={14} color={colors.teal} />
                    <Text style={[styles.licenseHintText, { color: colors.teal }]}>License selected. Ready to submit.</Text>
                  </View>
                )}
                <PrimaryButton label={t('register.submitApplication')} onPress={handleRegister} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Email Verification Modal */}
      <Modal visible={showVerificationModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.verifyModalContent, { backgroundColor: colors.bg1 }]}>
            <MailCheck size={48} color={colors.teal} />
            <Text style={[styles.verifyTitle, { color: colors.t1 }]}>Verify Your Email</Text>
            <Text style={[styles.verifyText, { color: colors.t2 }]}>
              We've sent a verification link to:
            </Text>
            <Text style={[styles.verifyEmail, { color: colors.teal }]}>{form.email}</Text>
            
            <Text style={[styles.verifyInstructions, { color: colors.t2 }]}>
              Please check your inbox and click the verification link.
              The link expires after 1 hour.
            </Text>
            
            {verificationError ? (
              <Text style={[styles.errorText, { color: colors.red }]}>{verificationError}</Text>
            ) : null}
            
            <View style={styles.verifyButtons}>
              <TouchableOpacity onPress={skipToStep2} style={[styles.verifyBtn, { backgroundColor: colors.teal }]}>
                <Text style={styles.verifyBtnText}>I've Verified</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={resendVerificationEmail} disabled={resendTimer > 0}>
                <Text style={[styles.resendText, { color: colors.teal }]}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Verification Email'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => {
                setShowVerificationModal(false);
                setVerificationError('');
                // Clean up the created user if they cancel
                if (tempUserCredential?.user) {
                  tempUserCredential.user.delete().catch(console.log);
                }
                setLoading(false);
              }}>
                <Text style={[styles.cancelVerifyText, { color: colors.red }]}>Cancel Registration</Text>
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
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  sub: { fontSize: 13, marginTop: 2 },
  stepBar: { height: 4, backgroundColor: C.bg2, borderRadius: 2, marginBottom: 24, overflow: 'hidden' },
  stepFill: { height: '100%', borderRadius: 2 },
  card: { borderRadius: R.xl, borderWidth: 1, overflow: 'hidden' },
  cardTop: { height: 4 },
  fields: { padding: 20 },
  fieldGroup: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  vtRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  vtChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.full, borderWidth: 1 },
  vtChipActive: { backgroundColor: C.teal + '20', borderColor: C.teal },
  vtLabel: { fontSize: 14, fontWeight: '600' },
  licensePicker: { marginVertical: 8, alignItems: 'center' },
  licensePlaceholder: { width: '100%', height: 160, borderRadius: R.md, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 },
  licensePlaceholderText: { fontSize: 14 },
  licensePreview: { width: '100%', height: 160, borderRadius: R.md, resizeMode: 'cover' },
  licenseHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, marginBottom: 12 },
  licenseHintText: { fontSize: 12 },
  divRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  divLine: { flex: 1, height: 1 },
  divText: { fontSize: 13 },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 14, borderRadius: 12, borderWidth: 1, marginTop: 10 },
  googleButtonText: { fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  verifyModalContent: { borderRadius: 24, padding: 24, width: '85%', alignItems: 'center' },
  verifyTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  verifyText: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
  verifyEmail: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  verifyInstructions: { fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  errorText: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  verifyButtons: { alignItems: 'center', gap: 12, width: '100%' },
  verifyBtn: { paddingVertical: 12, paddingHorizontal: 40, borderRadius: 30, width: '100%', alignItems: 'center' },
  verifyBtnText: { color: '#060B18', fontSize: 16, fontWeight: 'bold' },
  resendText: { fontSize: 14, marginTop: 8 },
  cancelVerifyText: { fontSize: 14, marginTop: 8 },
});