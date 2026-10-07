import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs, getDoc } from 'firebase/firestore';
import { Calendar, MapPin, Car, Bell } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { PrimaryButton, Pill, Loader } from '../components/UI';
import { sendLocalNotification } from '../services/notifications';
import i18n from '../i18n';

const ESP32_IP = '10.249.157.162';

export default function BookingListScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [bookings, setBookings] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingCancel, setProcessingCancel] = useState(null);

  

  
  useEffect(() => {
    let checkHardwareTrigger = setInterval(async () => {
      try {
        const response = await fetch(`http://${ESP32_IP}/status`, { method: 'GET' });
        const text = await response.text();
        if (text.trim() === '1') {
          console.log("🚗 Car detected! Starting session automatically...");
          clearInterval(checkHardwareTrigger);
          const user = auth.currentUser;
          let realSessionId = 'local_auto_session';
          let existingData = { hourlyRate: 15, stationName: 'Azezo', vehiclePlate: 'Auto Detected' };
          const isoEntryTime = new Date().toISOString();
          if (user) {
            const sessionsQuery = query(
              collection(db, 'parkingSessions'),
              where('userId', '==', user.uid),
              where('status', '==', 'booked'),
              where('approved', '==', true)
            );
            const querySnapshot = await getDocs(sessionsQuery);
            if (!querySnapshot.empty) {
              const matchedDoc = querySnapshot.docs[0];
              realSessionId = matchedDoc.id;
              existingData = matchedDoc.data();
              await updateDoc(doc(db, 'parkingSessions', realSessionId), {
                status: 'active',
                entryTime: isoEntryTime
              });
              console.log(" Session started automatically!");
            }
          }
          navigation.replace('ActiveParking', {
            session: {
              id: realSessionId,
              stationName: existingData.stationName || 'Azezo',
              vehiclePlate: existingData.vehiclePlate || 'Auto Detected',
              hourlyRate: existingData.hourlyRate || 15,
              entryTime: isoEntryTime
            }
          });
        }
      } catch (error) {
        console.log("Sensor polling...");
      }
    }, 1500);
    return () => clearInterval(checkHardwareTrigger);
  }, [navigation]);

  
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    const q = query(collection(db, 'parkingSessions'), where('userId', '==', uid));
    let previousStatus = {};
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.forEach(booking => {
        if (booking.approved && !previousStatus[booking.id]) {
          sendLocalNotification(
            i18n.t('notifications.bookingApproved'),
            i18n.t('notifications.bookingApprovedBody', { stationName: booking.stationName }),
            { screen: 'BookingList', sessionId: booking.id }
          );
        }
        previousStatus[booking.id] = booking.approved;
      });
      setActive(all.find(s => s.status === 'active') || null);
      setBookings(all.filter(s => s.status === 'booked').sort((a, b) => new Date(b.bookingTime) - new Date(a.bookingTime)));
      setLoading(false);
    });
  }, []);

  const startParking = async (session) => {
    if (!session.approved) {
      Alert.alert(t('errors.pendingApproval'), t('errors.waitForAttendant'));
      return;
    }
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'parkingSessions', session.id), { status: 'active', entryTime: now });
      navigation.navigate('ActiveParking', { session: { ...session, entryTime: now } });
    } catch (e) { Alert.alert(t('common.error'), e.message); }
  };

  const cancelBooking = async (session) => {
    setProcessingCancel(session.id);
    Alert.alert(
      'Cancel Booking',
      `Cancel your booking at ${session.stationName}?`,
      [
        { text: 'No', style: 'cancel', onPress: () => setProcessingCancel(null) },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'parkingSessions', session.id), {
                status: 'cancelled',
                cancellationTime: new Date().toISOString()
              });
              const stationRef = doc(db, 'parkingStations', session.stationId);
              const stationSnap = await getDoc(stationRef);
              if (stationSnap.exists()) {
                const vehicleType = session.vehicleType || 'car';
                const slotField = `${vehicleType}Available`;
                const currentSlots = stationSnap.data()[slotField] ?? 0;
                await updateDoc(stationRef, { [slotField]: currentSlots + 1 });
              }
              Alert.alert('Cancelled', 'Your booking has been cancelled.');
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setProcessingCancel(null);
            }
          }
        }
      ]
    );
  };

  if (loading) return <Loader />;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />
      <View style={[styles.header, { backgroundColor: isDark ? '#081428' : '#E0F2FE' }]}>
        <Text style={[styles.title, { color: colors.t1 }]}>{t('booking.myBookings')}</Text>
        <Text style={[styles.sub, { color: colors.t2 }]}>
          {bookings.length} {t('booking.upcomingCount')} • 
          {active ? ` 1 ${t('booking.activeSession')}` : ` ${t('booking.noBookings')}`}
        </Text>
      </View>
      <FlatList
        data={bookings}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {active && (
              <TouchableOpacity onPress={() => navigation.navigate('ActiveParking', { session: active })} activeOpacity={0.85}>
                <View style={[styles.activeBanner, { backgroundColor: isDark ? '#062820' : '#D1FAE5', borderColor: colors.green + '40' }]}>
                  <View style={[styles.activePulseRing, { backgroundColor: colors.green + '08' }]} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <View style={[styles.liveDot, { backgroundColor: colors.green }]} />
                      <Text style={[styles.liveLabel, { color: colors.green }]}>{t('booking.active')}</Text>
                    </View>
                    <Text style={[styles.activeStation, { color: colors.t1 }]}>{active.stationName}</Text>
                    <Text style={[styles.activeTime, { color: colors.t2 }]}>
                      {t('booking.enterAt')} {new Date(active.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.activeTapBtn, { backgroundColor: colors.tealBg, borderColor: colors.teal + '40' }]}>
                    <Text style={{ color: colors.teal, fontWeight: '900', fontSize: 14 }}>→</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            {bookings.length > 0 && <Text style={[styles.secLabel, { color: colors.t3 }]}>{t('booking.upcoming')}</Text>}
          </>
        }
        ListEmptyComponent={
          !active && (
            <View style={styles.empty}>
              <Text style={{ fontSize: 56 }}>📋</Text>
              <Text style={[styles.emptyTitle, { color: colors.t1 }]}>{t('booking.noBookings')}</Text>
              <Text style={[styles.emptyText, { color: colors.t2 }]}>{t('booking.bookNow')}</Text>
              <PrimaryButton 
                label={t('booking.bookNow')} 
                onPress={() => navigation.navigate('Main')}
                style={{ marginTop: 22, width: 200 }} 
              />
            </View>
          )
        }
        renderItem={({ item }) => (
          <BookingCard 
            item={item} 
            onStart={() => startParking(item)} 
            onCancel={() => cancelBooking(item)}
            processingCancel={processingCancel === item.id}
            t={t}
            colors={colors}
          />
        )}
      />
    </View>
  );
}

function BookingCard({ item, onStart, onCancel, processingCancel, t, colors }) {
  const date = new Date(item.bookingTime);
  const approved = item.approved;
  return (
    <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
      <View style={[styles.cardAccent, { backgroundColor: approved ? colors.teal : colors.gold }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: colors.bg3, borderColor: colors.border }]}>
            <Car size={22} color={colors.t1} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: colors.t1 }]}>{item.stationName}</Text>
            <Text style={[styles.cardPlate, { color: colors.t2 }]}>🚗 {item.vehiclePlate}</Text>
          </View>
          <Pill label={approved ? t('booking.approved') : t('booking.pending')} type={approved ? 'success' : 'warning'} />
        </View>
        <View style={[styles.statsRow, { backgroundColor: colors.bg1, borderColor: colors.border }]}>
          <MiniStat icon={<Calendar size={14} color={colors.t2} />} val={date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} lbl={t('activeParking.elapsed')} colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <MiniStat icon={<MapPin size={14} color={colors.t2} />} val={`${item.hourlyRate} ETB`} lbl={t('activeParking.rate')} colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <MiniStat icon={<Calendar size={14} color={colors.t2} />} val={date.toLocaleDateString([], { month: 'short', day: 'numeric' })} lbl="Date" colors={colors} />
        </View>
        {!approved ? (
          <View style={[styles.pendingBar, { backgroundColor: colors.goldBg, borderColor: colors.gold + '40' }]}>
            <Text style={{ fontSize: 16 }}>⏳</Text>
            <Text style={[styles.pendingText, { color: colors.gold }]}>{t('booking.pendingApproval')}</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={onStart} activeOpacity={0.85}>
            <View style={[styles.startBtn, { backgroundColor: colors.teal }]}>
              <Text style={[styles.startBtnText, { color: colors.inv }]}>🚗  {t('booking.startParking')}</Text>
            </View>
          </TouchableOpacity>
        )}
        {!approved && (
          <TouchableOpacity onPress={onCancel} disabled={processingCancel} style={[styles.cancelBtn, { backgroundColor: colors.red }]}>
            <Text style={styles.cancelBtnText}>{processingCancel ? 'Cancelling...' : 'Cancel Booking'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function MiniStat({ icon, val, lbl, colors }) {
  return (
    <View style={styles.miniStat}>
      {icon}
      <Text style={[styles.miniVal, { color: colors.t1 }]}>{val}</Text>
      <Text style={[styles.miniLbl, { color: colors.t3 }]}>{lbl}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 52, paddingBottom: 22, paddingHorizontal: 20 },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  sub: { fontSize: 13, marginTop: 4 },
  list: { padding: 20, paddingBottom: 36 },
  secLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 14, marginTop: 6 },
  activeBanner: { borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, borderWidth: 1.5, overflow: 'hidden' },
  activePulseRing: { position: 'absolute', width: 150, height: 150, borderRadius: 75, top: -30, right: -30 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  activeStation: { fontSize: 17, fontWeight: '900' },
  activeTime: { fontSize: 12, marginTop: 3 },
  activeTapBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  card: { borderRadius: 16, marginBottom: 14, overflow: 'hidden', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardAccent: { height: 3 },
  cardBody: { padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cardName: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  cardPlate: { fontSize: 12 },
  statsRow: { flexDirection: 'row', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1 },
  miniStat: { flex: 1, alignItems: 'center', gap: 3 },
  miniVal: { fontSize: 13, fontWeight: '800' },
  miniLbl: { fontSize: 10, fontWeight: '600' },
  statDivider: { width: 1, marginVertical: 2 },
  pendingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  pendingText: { fontSize: 13, fontWeight: '600', flex: 1 },
  startBtn: { borderRadius: 12, padding: 14, alignItems: 'center' },
  startBtnText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.2 },
  cancelBtn: { borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: 22, fontWeight: '900', marginTop: 14, marginBottom: 8 },
  emptyText: { fontSize: 14 },
});