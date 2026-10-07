import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, StatusBar } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { PrimaryButton, DangerButton } from '../components/UI';
import { db } from '../services/firebase';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';

const ESP32_IP = '10.249.157.162';

export default function ActiveParkingScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { session: initialSession } = route.params;
  const [session] = useState(initialSession);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isCarDetected, setIsCarDetected] = useState(true);
  const elapsedSecondsRef = useRef(0);
  const sessionActiveTimeRef = useRef(0);

  const entryDate = session.entryTime ? new Date(session.entryTime) : null;
  const isValidDate = entryDate && !isNaN(entryDate.getTime());

  useEffect(() => {
    if (!isValidDate) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - entryDate) / 1000);
      const safe = diff > 0 ? diff : 0;
      setElapsedSeconds(safe);
      elapsedSecondsRef.current = safe;
      sessionActiveTimeRef.current += 1;
    }, 1000);
    return () => clearInterval(interval);
  }, [isValidDate]);

  useEffect(() => {
    let polling = setInterval(async () => {
      try {
        const res = await fetch(`http://${ESP32_IP}/status`);
        const text = (await res.text()).trim();
        const present = text === '1';
        setIsCarDetected(present);
        if (!present && sessionActiveTimeRef.current > 3) {
          clearInterval(polling);
          autoExecuteSessionCheckout(elapsedSecondsRef.current);
        }
      } catch (err) {}
    }, 1000);
    return () => clearInterval(polling);
  }, []);

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  
  const autoExecuteSessionCheckout = async (currentSeconds) => {
    setLoading(true);
    const hours = currentSeconds / 3600;
    const totalFee = hours * (session.hourlyRate || 15);
    const fee = totalFee > 0 ? parseFloat(totalFee.toFixed(2)) : 0.05;

   
    if (session.id && session.id !== 'local_auto_session') {
      try {
        await updateDoc(doc(db, 'parkingSessions', session.id), {
          status: 'completed',
          exitTime: new Date().toISOString(),
          totalFee: fee,
          paymentStatus: 'pending'
        });
        console.log("✅ Firestore session updated to completed");
      } catch (err) {
        console.error(err);
      }
    }

    
    let stationId = session.stationId;
    let vehicleType = session.vehicleType || 'car';

    
    if (!stationId && session.id && session.id !== 'local_auto_session') {
      try {
        const snap = await getDoc(doc(db, 'parkingSessions', session.id));
        if (snap.exists()) {
          const data = snap.data();
          stationId = data.stationId;
          vehicleType = data.vehicleType || 'car';
        }
      } catch (e) {
        console.warn('Could not fetch session for slot release:', e);
      }
    }

    if (stationId) {
      try {
        const slotField = `${vehicleType}Available`;  // carAvailable, motorcycleAvailable, truckAvailable
        await updateDoc(doc(db, 'parkingStations', stationId), {
          [slotField]: increment(1)
        });
        console.log(`➕ Slot released: ${slotField} incremented at station ${stationId}`);
      } catch (err) {
        console.error('Failed to increment slot:', err);
      }
    }

   
    navigation.replace('Payment', {
      sessionId: session.id,
      amount: fee,
      stationName: session.stationName,
    });
  };

  const manualEnd = () => {
    Alert.alert('End Parking', 'End session and proceed to payment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End', onPress: () => autoExecuteSessionCheckout(elapsedSeconds) }
    ]);
  };

  if (!isValidDate) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg0 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />
        <View style={styles.container}>
          <Text style={[styles.errorText, { color: colors.t1 }]}>⚠️ No valid start time.</Text>
          <PrimaryButton label="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  const cost = (elapsedSeconds / 3600) * (session.hourlyRate || 15);
  const rate = session.hourlyRate || 15;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <Text style={[styles.backArrow, { color: colors.t1 }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.t1 }]}>Live Session</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={[styles.statusBanner, { backgroundColor: isCarDetected ? colors.teal + '20' : colors.red + '20', borderColor: isCarDetected ? colors.teal : colors.red }]}>
        <Text style={[styles.statusBannerText, { color: isCarDetected ? colors.teal : colors.red }]}>
          {isCarDetected ? "🟢 VEHICLE DETECTED" : "⚪ SLOT EMPTY"}
        </Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        <Text style={[styles.stationName, { color: colors.t1 }]}>{session.stationName}</Text>
        <Text style={[styles.plate, { color: colors.t2 }]}>🚗 {session.vehiclePlate}</Text>
        <View style={[styles.costRow, { backgroundColor: colors.goldBg }]}>
          <Text style={[styles.costLabel, { color: colors.t2 }]}>Running Cost</Text>
          <Text style={[styles.costValue, { color: colors.gold }]}>{cost.toFixed(2)} ETB</Text>
        </View>
        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, { color: colors.t3 }]}>TIME ELAPSED</Text>
          <Text style={[styles.timeValue, { color: colors.teal }]}>{formatTime(elapsedSeconds)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.t2 }]}>Start</Text>
          <Text style={[styles.infoValue, { color: colors.t1 }]}>{entryDate.toLocaleTimeString()}</Text>
        </View>
      </View>
      <View style={[styles.breakdownCard, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        <Text style={[styles.breakdownTitle, { color: colors.t3 }]}>COST BREAKDOWN</Text>
        <View style={styles.breakRow}><Text style={[styles.breakLabel, { color: colors.t2 }]}>Elapsed</Text><Text style={[styles.breakValue, { color: colors.t1 }]}>{formatTime(elapsedSeconds)}</Text></View>
        <View style={styles.breakRow}><Text style={[styles.breakLabel, { color: colors.t2 }]}>Rate</Text><Text style={[styles.breakValue, { color: colors.t1 }]}>{rate} ETB/hr</Text></View>
        <View style={styles.breakRow}><Text style={[styles.breakLabel, { color: colors.t2 }]}>Total</Text><Text style={[styles.breakValue, { color: colors.teal }]}>{cost.toFixed(2)} ETB</Text></View>
      </View>
      <View style={styles.actions}>
        <DangerButton label={loading ? 'Ending...' : 'End Session'} onPress={manualEnd} disabled={loading} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  backArrow: { fontSize: 20 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  statusBanner: { marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  statusBannerText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  card: { borderRadius: 16, margin: 20, marginTop: 10, padding: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  stationName: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  plate: { fontSize: 14, marginBottom: 20 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderRadius: 12, marginBottom: 16 },
  costLabel: { fontSize: 14 },
  costValue: { fontSize: 18, fontWeight: '900' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 16, marginBottom: 12 },
  timeLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  timeValue: { fontSize: 20, fontWeight: '900', fontFamily: 'monospace' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  breakdownCard: { borderRadius: 16, marginHorizontal: 20, marginBottom: 20, padding: 18, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  breakdownTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginBottom: 14 },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  breakLabel: { fontSize: 14 },
  breakValue: { fontSize: 14 },
  actions: { paddingHorizontal: 20, flexDirection: 'row' },
});