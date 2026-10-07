import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Linking, ScrollView, StatusBar, Image, FlatList, Dimensions
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../services/firebase';
import { collection, doc, setDoc, getDoc, updateDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';
import { PrimaryButton, GhostButton, Pill, RowInfo, Divider, Loader } from '../components/UI';

const { width: screenWidth } = Dimensions.get('window');

export default function StationDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { station } = route.params;
  const { colors, isDark } = useTheme();

  const [vehicleType, setVehicleType] = useState('car');
  const [availableSlots, setAvailableSlots] = useState(0);
  const [totalSlots, setTotalSlots] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(15);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [extraServices, setExtraServices] = useState([]);
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);
  const flatListRef = useRef(null);
  const autoSlideInterval = useRef(null);

  useEffect(() => {
    const loadVehicleType = async () => {
      try {
        const savedType = await AsyncStorage.getItem('active_session_vehicle_type');
        if (savedType === 'car' || savedType === 'motorcycle' || savedType === 'truck' || savedType === 'bajaj') {
          setVehicleType(savedType);
        } else {
          setVehicleType('car');
        }
      } catch (error) {
        setVehicleType('car');
      }
    };
    loadVehicleType();
  }, []);

  useEffect(() => {
    if (!station) return;

    const availField = `${vehicleType}Available`;
    const totalField = `${vehicleType}Slots`;

    let rateField;
    if (vehicleType === 'truck') {
      rateField = 'truckerRate';
    } else if (vehicleType === 'bajaj') {
      rateField = 'bajajRate';
    } else if (vehicleType === 'motorcycle') {
      rateField = 'motorcycleRate';
    } else {
      rateField = 'carRate';
    }

    const avail = station[availField] ?? station.available_slots ?? 0;
    const total = station[totalField] ?? station.total_slots ?? 0;
    const rate = station[rateField] ?? station.hourly_rate ?? 15;

    setAvailableSlots(Number(avail));
    setTotalSlots(Number(total));
    setHourlyRate(Number(rate));
    setPageLoading(false);
  }, [vehicleType, station]);

  useEffect(() => {
    if (!station?.id) return;
    if (station.serviceDetails && station.serviceDetails.length > 0) {
      setExtraServices(station.serviceDetails);
      return;
    }
    const servicesRef = collection(db, 'parkingStations', station.id, 'services');
    const unsubscribe = onSnapshot(servicesRef, (snapshot) => {
      const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExtraServices(services);
    });
    return () => unsubscribe();
  }, [station?.id]);

  useEffect(() => {
    if (extraServices.length <= 1) return;
    autoSlideInterval.current = setInterval(() => {
      let nextIndex = activeServiceIndex + 1;
      if (nextIndex >= extraServices.length) nextIndex = 0;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveServiceIndex(nextIndex);
    }, 4000);
    return () => clearInterval(autoSlideInterval.current);
  }, [extraServices.length, activeServiceIndex]);

  const onScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (index !== activeServiceIndex) setActiveServiceIndex(index);
  };

  const goToPrev = () => {
    let prevIndex = activeServiceIndex - 1;
    if (prevIndex < 0) prevIndex = extraServices.length - 1;
    flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    setActiveServiceIndex(prevIndex);
  };

  const goToNext = () => {
    let nextIndex = activeServiceIndex + 1;
    if (nextIndex >= extraServices.length) nextIndex = 0;
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setActiveServiceIndex(nextIndex);
  };

  const pct = Math.round(availableSlots / Math.max(totalSlots, 1) * 100);
  const isFull = availableSlots <= 0;
  const col = availableSlots === 0 ? colors.red : availableSlots < 5 ? colors.gold : colors.green;
  let statusKey = 'stationDetail.available';
  if (availableSlots === 0) statusKey = 'stationDetail.lotFull';
  else if (availableSlots < 5) statusKey = 'stationDetail.almostFull';
  const statusLabel = t(statusKey);
  const statusType = availableSlots === 0 ? 'danger' : availableSlots < 5 ? 'warning' : 'success';
  const translatedStationName = t(`stationNames.${station.name}`, { defaultValue: station.name });
  const destinationLat = station.latitude ?? station.lat ?? 0;
  const destinationLng = station.longitude ?? station.lng ?? 0;

  const openDirections = () =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`);

  const handleBook = async () => {
    if (isFull) {
      Alert.alert(t('stationDetail.lotFull'), t('errors.noAvailableSlots'));
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      Alert.alert(t('errors.signInRequired'), t('errors.pleaseSignIn'));
      return;
    }
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('authUid', '==', user.uid));
      const querySnap = await getDocs(q);
      if (querySnap.empty) {
        Alert.alert("Error", "User profile not found.");
        setLoading(false);
        return;
      }
      const userDoc = querySnap.docs[0];
      const userData = userDoc.data();
      const username = userDoc.id;
      const plate = userData.vehiclePlate || 'Unknown';

      const cleanStationName = station.name.replace(/\s/g, '_');
      const timestamp = Date.now();
      const sessionId = `${username}_${cleanStationName}_${timestamp}`;
      await setDoc(doc(db, 'parkingSessions', sessionId), {
        sessionId: sessionId,
        userId: user.uid,
        username: username,
        stationId: station.id,
        stationName: station.name,
        status: 'booked',
        approved: false,
        hourlyRate: hourlyRate,
        vehiclePlate: plate,
        vehicleType: vehicleType,
        bookingTime: new Date().toISOString(),
        entryTime: null,
        exitTime: null,
        totalFee: 0,
        paymentStatus: 'pending',
      });

      const stRef = doc(db, 'parkingStations', station.id);
      const stSnap = await getDoc(stRef);
      const currentData = stSnap.data();
      const slotField = `${vehicleType}Available`;
      let currentSlots = currentData[slotField];
      if (currentSlots === undefined) {
        currentSlots = currentData.available_slots ?? 0;
      }
      await updateDoc(stRef, { [slotField]: currentSlots - 1 });

      Alert.alert(t('errors.bookingSent'), t('errors.bookingSentMsg'), [
        { 
          text: t('errors.viewBookings'), 
          onPress: () => navigation.navigate('Main', { screen: 'Bookings' }) // ✅ FIXED
        },
        { 
          text: t('common.ok'), 
          onPress: () => navigation.navigate('Main', { screen: 'Explore' }) // ✅ FIXED
        },
      ]);
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) return <Loader />;

  const getVehicleIcon = () => {
    switch (vehicleType) {
      case 'car': return '🚗';
      case 'motorcycle': return '🏍️';
      case 'truck': return '🚛';
      case 'bajaj': return '🛺';  
      default: return '🚗';
    }
  };

  const renderServiceItem = ({ item }) => (
    <View style={[styles.serviceSlide, { backgroundColor: colors.bg2 }]}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.serviceImage} />
      ) : (
        <View style={[styles.serviceImagePlaceholder, { backgroundColor: colors.bg1 }]}>
          <Text style={{ fontSize: 36 }}>🛠️</Text>
        </View>
      )}
      <Text style={[styles.serviceName, { color: colors.t1 }]}>{item.name}</Text>
      <Text style={[styles.serviceDesc, { color: colors.t2 }]}>{item.description || 'No description provided.'}</Text>
      <View style={styles.priceTag}>
        <Text style={[styles.priceText, { color: colors.teal }]}>{item.price} ETB</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />
      <View style={[styles.hero, { backgroundColor: isDark ? '#0C1E3A' : '#E0F2FE' }]}>
        <View style={[styles.heroBlob, { backgroundColor: colors.tealGlow }]} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colors.border }]}>
          <Text style={[styles.backArrow, { color: colors.t1 }]}>←</Text>
        </TouchableOpacity>
        <View style={[styles.heroIcon, { backgroundColor: colors.bg2, borderColor: colors.teal + '40' }]}>
          <Text style={{ fontSize: 42 }}>🅿</Text>
        </View>
        <Text style={[styles.heroName, { color: colors.t1 }]}>{translatedStationName}</Text>
        <Text style={[styles.heroAddr, { color: colors.t2 }]}>📍 {station.address}</Text>
        <View style={styles.heroBadges}>
          <Pill label={statusLabel} type={statusType} />
          {station.distance != null && (
            <View style={[styles.distPill, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
              <Text style={[styles.distText, { color: colors.t2 }]}>📍 {station.distance.toFixed(1)} km</Text>
            </View>
          )}
        </View>
      </View>
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { marginTop: 0, backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <View style={styles.meterHead}>
            <Text style={[styles.meterLabel, { color: colors.t2 }]}>{t('stationDetail.availableSpots')}</Text>
            <Text style={[styles.meterCount, { color: col }]}>{availableSlots} / {totalSlots}</Text>
          </View>
          <View style={[styles.meterBg, { backgroundColor: colors.bg0 }]}>
            <View style={[styles.meterFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: col }]} />
          </View>
          <View style={styles.dotGrid}>
            {Array.from({ length: Math.min(totalSlots, 24) }).map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i < availableSlots ? col : colors.bg0 }]} />
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <Text style={[styles.secLabel, { color: colors.t3 }]}>{t('stationDetail.stationDetails')}</Text>
          <RowInfo icon={getVehicleIcon()} label={t('stationDetail.vehicleType')} value={vehicleType.toUpperCase()} valueColor={colors.t1} />
          <RowInfo icon="" label={t('stationDetail.hourlyRate')} value={`${hourlyRate} ${t('stationDetail.perHour')}`} valueColor={colors.gold} />
          <RowInfo icon="" label={t('stationDetail.totalCapacity')} value={`${totalSlots} ${t('stationDetail.spots')}`} valueColor={colors.t1} />
          <RowInfo icon="" label={t('stationDetail.availableNow')} value={`${availableSlots} ${t('stationDetail.spots')}`} valueColor={col} />
          <RowInfo icon="" label={t('stationDetail.hours')} value={t('stationDetail.open247')} valueColor={colors.t1} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <Text style={[styles.secLabel, { color: colors.t3 }]}>{t('stationDetail.features')}</Text>
          {station.features && station.features.length > 0 ? (
            <View style={styles.featGrid}>
              {station.features.map((feature, idx) => (
                <View key={idx} style={[styles.featChip, { backgroundColor: colors.bg1, borderColor: colors.border }]}>
                  <Text style={[styles.featText, { color: colors.t2 }]}>{feature}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.noFeaturesText, { color: colors.t3 }]}>{t('stationDetail.noFeatures')}</Text>
          )}
        </View>

        {extraServices.length > 0 && (
          <View style={[styles.servicesCarousel, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <Text style={[styles.sectionHeader, { color: colors.t1 }]}>✨ Extra Services Available</Text>
            <FlatList
              ref={flatListRef}
              data={extraServices}
              renderItem={renderServiceItem}
              keyExtractor={(item, idx) => idx.toString()}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              style={{ width: screenWidth - 40, alignSelf: 'center' }}
            />
            {extraServices.length > 1 && (
              <View style={styles.carouselControls}>
                <TouchableOpacity onPress={goToPrev} style={[styles.arrowBtn, { backgroundColor: colors.bg1, borderColor: colors.border }]}>
                  <Text style={[styles.arrowText, { color: colors.t1 }]}>◀</Text>
                </TouchableOpacity>
                <View style={styles.paginationDots}>
                  {extraServices.map((_, idx) => (
                    <View key={idx} style={[styles.dotIndicator, { backgroundColor: colors.t3 }, activeServiceIndex === idx && { backgroundColor: colors.teal, width: 12 }]} />
                  ))}
                </View>
                <TouchableOpacity onPress={goToNext} style={[styles.arrowBtn, { backgroundColor: colors.bg1, borderColor: colors.border }]}>
                  <Text style={[styles.arrowText, { color: colors.t1 }]}>▶</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        
        <View style={{ height: 20 }} />
      </ScrollView>
      <View style={[styles.actions, { backgroundColor: colors.bg1, borderTopColor: colors.border }]}>
        <GhostButton icon="🗺️" label={t('stationDetail.directions')} onPress={openDirections} style={styles.dirBtn} />
        <PrimaryButton
          icon={isFull ? '🚫' : '📅'}
          label={isFull ? t('stationDetail.lotFull') : t('stationDetail.bookNow')}
          onPress={handleBook}
          disabled={isFull}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingTop: 52, paddingBottom: 30, paddingHorizontal: 20, alignItems: 'center', overflow: 'hidden' },
  heroBlob: { position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -100, right: -60 },
  backBtn: { position: 'absolute', top: 52, left: 20, width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  backArrow: { fontSize: 20 },
  heroIcon: { width: 84, height: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  heroName: { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  heroAddr: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  heroBadges: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  distPill: { borderRadius: 100, paddingVertical: 4, paddingHorizontal: 12, borderWidth: 1 },
  distText: { fontSize: 12, fontWeight: '600' },
  body: { flex: 1, padding: 20 },
  card: { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  secLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 14 },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  meterLabel: { fontSize: 13, fontWeight: '700' },
  meterCount: { fontSize: 14, fontWeight: '900' },
  meterBg: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  meterFill: { height: '100%', borderRadius: 4 },
  dotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dot: { width: 11, height: 11, borderRadius: 3 },
  featGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featChip: { borderRadius: 100, paddingVertical: 6, paddingHorizontal: 13, borderWidth: 1 },
  featText: { fontSize: 12, fontWeight: '600' },
  noFeaturesText: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1 },
  dirBtn: { paddingHorizontal: 16 },
  servicesCarousel: { marginTop: 20, marginBottom: 14, borderRadius: 12, borderWidth: 1, paddingVertical: 16 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, paddingHorizontal: 16 },
  serviceSlide: { width: screenWidth - 40, alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, borderRadius: 12 },
  serviceImage: { width: 100, height: 100, borderRadius: 12, marginBottom: 12 },
  serviceImagePlaceholder: { width: 100, height: 100, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  serviceName: { fontSize: 18, fontWeight: 'bold', textTransform: 'capitalize', marginBottom: 4 },
  serviceDesc: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  priceTag: { backgroundColor: '#00E5C420', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  priceText: { fontWeight: 'bold', fontSize: 16 },
  carouselControls: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 },
  arrowBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  arrowText: { fontSize: 20, fontWeight: 'bold' },
  paginationDots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dotIndicator: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 2 },
});