import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { C, R } from '../theme';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignInButton({ onSuccess, onError }) {
  const { t } = useTranslation();

  // ✅ YOUR ACTUAL WEB CLIENT ID
  const webClientId = '993616491919-uaohj92qh54al5kvbk5s6gc0kkp7h70g.apps.googleusercontent.com';

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: webClientId,
    androidClientId: webClientId,   // ✅ ADD THIS – required for Android
    webClientId: webClientId,
  });

  useEffect(() => {
    const handleGoogleSignIn = async () => {
      if (response?.type === 'success') {
        const { id_token } = response.params;
        try {
          const credential = GoogleAuthProvider.credential(id_token);
          const userCredential = await signInWithCredential(auth, credential);
          const user = userCredential.user;

          // Create user document in Firestore if it doesn't exist
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);
          if (!userSnap.exists()) {
            const nameParts = user.displayName ? user.displayName.split(' ') : ['Google', 'User'];
            await setDoc(userDocRef, {
              username: user.email?.split('@')[0] || 'user_' + user.uid.slice(0, 6),
              fullName: user.displayName || 'Google User',
              firstName: nameParts[0] || 'Google',
              lastName: nameParts.slice(1).join(' ') || 'User',
              email: user.email,
              phone: user.phoneNumber || '',
              vehicles: [],
              vehiclePlate: '',
              vehicleType: 'car',
              vehicleColor: '',
              role: 'driver',
              createdAt: new Date().toISOString(),
            });
          }
          if (onSuccess) onSuccess(userCredential);
        } catch (error) {
          console.error('Firebase Google Sign-In Error:', error);
          Alert.alert(t('common.error'), error.message);
          if (onError) onError(error);
        }
      } else if (response?.type === 'error') {
        Alert.alert(t('common.error'), response.error?.message || 'Google sign-in failed.');
        if (onError) onError(response.error);
      }
    };
    handleGoogleSignIn();
  }, [response]);

  return (
    <TouchableOpacity
      style={styles.googleBtn}
      onPress={() => promptAsync()}
      disabled={!request}
    >
      {!request ? (
        <ActivityIndicator color={C.t1} />
      ) : (
        <Text style={styles.googleText}>🔵 {t('register.continueGoogle')}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg1,
    marginTop: 4,
  },
  googleText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.t1,
  },
});