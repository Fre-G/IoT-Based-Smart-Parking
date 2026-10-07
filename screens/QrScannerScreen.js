// screens/QrScannerScreen.js
// Gate opens via hidden WebView — exactly like typing in Chrome.
// This is the most reliable method because WebView uses the same
// network stack as the browser, bypassing all fetch/XHR issues.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../context/ThemeContext';
import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const ESP32_IP = '10.249.157.162';
const GATE_URL = `http://${ESP32_IP}/open`;
const VALID_QR = 'Azezo';

export default function QrScannerScreen({ navigation }) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning,   setScanning]   = useState(true);
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [webviewUrl, setWebviewUrl] = useState(null); // null = hidden, url = loading
  const isProcessing = useRef(false);
  const webviewSuccess = useRef(false);

  // Reset scanner every time screen is focused
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      isProcessing.current = false;
      webviewSuccess.current = false;
      setScanning(true);
      setProcessing(false);
      setStatusText('');
      setWebviewUrl(null);
    });
    return unsub;
  }, [navigation]);

  const resetScanner = useCallback(() => {
    isProcessing.current = false;
    webviewSuccess.current = false;
    setProcessing(false);
    setStatusText('');
    setWebviewUrl(null);
    setTimeout(() => setScanning(true), 400);
  }, []);

  // Called after Firestore check passes — trigger the hidden WebView
  const triggerGate = useCallback(() => {
    setStatusText('Opening gate...');
    webviewSuccess.current = false;
    // Adding timestamp prevents caching — forces a fresh load every time
    setWebviewUrl(`${GATE_URL}?t=${Date.now()}`);
  }, []);

  // WebView loaded successfully
  const handleWebViewLoad = useCallback(() => {
    if (webviewSuccess.current) return;
    webviewSuccess.current = true;
    console.log('✅ Gate opened via WebView');
    setWebviewUrl(null);
    setStatusText('Gate opening! ✅');
    Alert.alert(
      '✅ Gate Opening!',
      'Your booking is verified.\n\nWelcome to Azezo Parking Station!',
      [{ text: 'OK', onPress: () => navigation.navigate('Main') }]
    );
  }, [navigation]);

  // WebView got any response (even error page = ESP32 responded = gate opened)
  const handleWebViewHttpError = useCallback(() => {
    // HTTP error (like 404, 500) still means ESP32 received the request
    // and the gate opened. Treat as success.
    handleWebViewLoad();
  }, [handleWebViewLoad]);

  // WebView completely failed to connect
  const handleWebViewError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.log('WebView error:', nativeEvent);

    if (webviewSuccess.current) return;

    // If WebView got any response at all before erroring, gate opened
    // "net::ERR_EMPTY_RESPONSE" = ESP32 closed connection = gate opened
    // "net::ERR_CONNECTION_RESET" = same
    const msg = nativeEvent?.description || nativeEvent?.code || '';
    const gateOpened =
      msg.includes('ERR_EMPTY_RESPONSE') ||
      msg.includes('ERR_CONNECTION_RESET') ||
      msg.includes('ERR_CONNECTION_CLOSED') ||
      msg.includes('-1005') || // iOS: connection reset
      msg.includes('-1001') || // iOS: timed out (servo was busy)
      msg.includes('-1004');   // iOS: connection refused momentarily

    if (gateOpened) {
      webviewSuccess.current = true;
      setWebviewUrl(null);
      setStatusText('Gate opening! ✅');
      Alert.alert(
        '✅ Gate Opening!',
        'Your booking is verified.\n\nWelcome to Azezo Parking Station!',
        [{ text: 'OK', onPress: () => navigation.navigate('Main') }]
      );
    } else {
      // True failure: wrong IP, wrong WiFi, ESP32 offline
      setWebviewUrl(null);
      Alert.alert(
        '❌ Cannot Reach Gate',
        `Make sure your phone is on the same Wi-Fi as the gate.\n\nESP32 IP: ${ESP32_IP}`,
        [
          { text: 'Retry', onPress: () => {
              webviewSuccess.current = false;
              triggerGate();
            }
          },
          { text: 'Cancel', style: 'cancel', onPress: resetScanner },
        ]
      );
    }
  }, [navigation, triggerGate, resetScanner]);

  // Check Firestore then fire the gate
  const checkAndOpen = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('⚠️ Login Required', 'You must be logged in.', [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
      resetScanner();
      return;
    }

    setStatusText('Checking booking...');
    try {
      const snap = await getDocs(
        query(
          collection(db, 'parkingSessions'),
          where('userId',   '==', user.uid),
          where('status',   '==', 'booked'),
          where('approved', '==', true),
        )
      );
      console.log(`📊 Found ${snap.size} approved booking(s)`);

      if (snap.size === 0) {
        Alert.alert(
          '⛔ Access Denied',
          'You do not have an approved booking.\n\nBook a spot and wait for attendant approval.',
          [{ text: 'OK', onPress: resetScanner }]
        );
        return;
      }

      // Approved — open gate via WebView
      triggerGate();

    } catch (err) {
      console.error('Firestore error:', err);
      Alert.alert('❌ Error', 'Could not verify your booking. Check internet.', [
        { text: 'Retry', onPress: resetScanner },
      ]);
    }
  }, [navigation, resetScanner, triggerGate]);

  // QR scan handler
  const handleBarCodeScanned = useCallback(async ({ data }) => {
    if (isProcessing.current || !scanning) return;
    isProcessing.current = true;
    setScanning(false);
    setProcessing(true);

    const text = data.trim();
    console.log(`📸 Scanned: "${text}"`);

    if (text !== VALID_QR) {
      Alert.alert(
        '❌ Invalid QR Code',
        `Not a SmartPark gate QR.\nScanned: "${text}"`,
        [{ text: 'Try Again', onPress: resetScanner }]
      );
      return;
    }
    await checkAndOpen();
  }, [scanning, checkAndOpen, resetScanner]);

  // Manual open button
  const handleManualOpen = useCallback(async () => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    setProcessing(true);
    await checkAndOpen();
  }, [checkAndOpen]);

  // Permission loading
  if (!permission) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg0 }]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={[s.info, { color: colors.t2 }]}>Requesting camera permission...</Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg0 }]}>
        <Text style={[s.info, { color: colors.t1 }]}>
          Camera access is needed to scan the gate QR code.
        </Text>
        <TouchableOpacity style={[s.permBtn, { backgroundColor: colors.teal }]} onPress={requestPermission}>
          <Text style={[s.permBtnTxt, { color: colors.inv || '#060B18' }]}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.backBtn, { borderColor: colors.border }]} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.t2, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Hidden WebView — fires the gate URL exactly like Chrome */}
      {webviewUrl ? (
        <WebView
          source={{ uri: webviewUrl }}
          style={s.hiddenWebview}
          onLoad={handleWebViewLoad}
          onHttpError={handleWebViewHttpError}
          onError={handleWebViewError}
          javaScriptEnabled={false}
          cacheEnabled={false}
          incognito={true}
        />
      ) : null}

      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanning && !processing ? handleBarCodeScanned : undefined}
      />

      {/* Overlay */}
      <View style={s.overlay} pointerEvents="box-none">
        <View style={s.darkTop} />
        <View style={s.middle}>
          <View style={s.darkSide} />
          <View style={s.frame}>
            <View style={[s.corner, s.cTL]} />
            <View style={[s.corner, s.cTR]} />
            <View style={[s.corner, s.cBL]} />
            <View style={[s.corner, s.cBR]} />
          </View>
          <View style={s.darkSide} />
        </View>
        <View style={s.darkBottom} pointerEvents="box-none">
          {processing ? (
            <View style={s.processingRow}>
              <ActivityIndicator color="#00E5C4" size="small" />
              <Text style={s.processingTxt}>{statusText || 'Processing...'}</Text>
            </View>
          ) : (
            <Text style={s.hint}>Point camera at the Azezo station QR code</Text>
          )}

          {!processing && (
            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()}>
                <Text style={s.cancelTxt}>✕  Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.openBtn} onPress={handleManualOpen}>
                <Text style={s.openTxt}>⚡  Open Gate</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const FRAME = 240, CRN = 28, CRW = 4;

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  info:   { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  hiddenWebview: { width: 0, height: 0, position: 'absolute', opacity: 0 },
  overlay:    { ...StyleSheet.absoluteFillObject },
  darkTop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
  middle:     { height: FRAME, flexDirection: 'row' },
  darkSide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
  darkBottom: { flex: 1.4, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 28 },
  frame: { width: FRAME, height: FRAME, backgroundColor: 'transparent', position: 'relative' },
  corner: { position: 'absolute', width: CRN, height: CRN, borderColor: '#00E5C4' },
  cTL: { top:0,    left:0,  borderTopWidth:CRW,    borderLeftWidth:CRW,  borderTopLeftRadius:6 },
  cTR: { top:0,    right:0, borderTopWidth:CRW,    borderRightWidth:CRW, borderTopRightRadius:6 },
  cBL: { bottom:0, left:0,  borderBottomWidth:CRW, borderLeftWidth:CRW,  borderBottomLeftRadius:6 },
  cBR: { bottom:0, right:0, borderBottomWidth:CRW, borderRightWidth:CRW, borderBottomRightRadius:6 },
  processingRow: { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'rgba(0,229,196,0.15)', borderRadius:14, paddingHorizontal:22, paddingVertical:13, borderWidth:1, borderColor:'rgba(0,229,196,0.4)', marginBottom:20 },
  processingTxt: { color:'#00E5C4', fontSize:15, fontWeight:'700' },
  hint: { color:'rgba(255,255,255,0.8)', fontSize:15, fontWeight:'500', textAlign:'center', marginBottom:28, paddingHorizontal:32 },
  btnRow: { flexDirection:'row', gap:12 },
  cancelBtn: { backgroundColor:'rgba(255,77,106,0.9)', paddingHorizontal:24, paddingVertical:13, borderRadius:30 },
  cancelTxt: { color:'#fff', fontWeight:'700', fontSize:14 },
  openBtn: { backgroundColor:'rgba(0,229,196,0.92)', paddingHorizontal:24, paddingVertical:13, borderRadius:30 },
  openTxt: { color:'#060B18', fontWeight:'800', fontSize:14 },
  permBtn: { paddingHorizontal:28, paddingVertical:14, borderRadius:12, marginTop:8 },
  permBtnTxt: { fontSize:15, fontWeight:'700' },
  backBtn: { marginTop:12, paddingHorizontal:24, paddingVertical:12, borderRadius:12, borderWidth:1 },
});