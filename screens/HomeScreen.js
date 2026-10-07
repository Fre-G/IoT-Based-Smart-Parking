import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl, Modal, FlatList, Dimensions, Image, Animated
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../services/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import * as Location from 'expo-location';
import { Bell, Search, MapPin, Car, Bike, Truck, QrCode, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { Pill, Loader } from '../components/UI';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.85;
const CARD_MARGIN = 16;

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const slotColor = (avail, total, colors) => {
  const p = avail / Math.max(total, 1);
  return p > 0.5 ? colors.green : p > 0.2 ? colors.gold : colors.red;
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [stations, setStations] = useState([]);
  const [search, setSearch] = useState('');
  const [loc, setLoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOption, setSortOption] = useState('distance');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [userName, setUserName] = useState('Driver');
  const [vehicleType, setVehicleType] = useState('car');
  const [activeIndex, setActiveIndex] = useState(0);
  const user = auth.currentUser;
  const flatListRef = useRef(null);
  const autoSlideInterval = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadVehicle = async () => {
      try {
        const saved = await AsyncStorage.getItem('active_session_vehicle_type');
        if (saved === 'car' || saved === 'motorcycle' || saved === 'truck') {
          setVehicleType(saved);
        } else {
          setVehicleType('car');
        }
      } catch (e) {
        setVehicleType('car');
      }
    };
    loadVehicle();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchUserName = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const name = data.username || data.fullName || user.email?.split('@')[0] || 'Driver';
          setUserName(name);
        } else {
          setUserName(user.email?.split('@')[0] || 'Driver');
        }
      } catch (error) {
        setUserName(user.email?.split('@')[0] || 'Driver');
      }
    };
    fetchUserName();
  }, [user]);

  const fetchStations = async () => {
    try {
      const snap = await getDocs(collection(db, 'parkingStations'));
      const stationsData = snap.docs.map(d => {
        const v = d.data();
        let features = [];
        if (Array.isArray(v.features)) {
          features = v.features;
        } else if (typeof v.services === 'string' && v.services.trim() !== '') {
          features = v.services.split(',').map(s => s.trim());
        }
        const availField = `${vehicleType}Available`;
        const totalField = `${vehicleType}Slots`;
        const rateField = `${vehicleType}Rate`;
        const avail = v[availField] ?? v.available_slots ?? 0;
        const total = v[totalField] ?? v.total_slots ?? 0;
        const rate = v[rateField] ?? v.hourly_rate ?? 0;
        return {
          id: d.id,
          name: v.name || d.id || v.stationName,
          address: v.address || '',
          lat: parseFloat(v.lat) || 0,
          lng: parseFloat(v.lng) || 0,
          available_slots: Number(avail),
          total_slots: Number(total),
          hourly_rate: Number(rate),
          features,
          imageUrl: v.imageUrl || v.image || v.photo || null,
        };
      });
      const filtered = stationsData.filter(station => station.total_slots > 0);
      setStations(filtered);
    } catch (error) {
      console.error('Error fetching stations:', error);
    }
  };

  useEffect(() => {
    fetchStations();
  }, [vehicleType]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const l = await Location.getCurrentPositionAsync({});
        setLoc(l.coords);
      }
      await fetchStations();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (stations.length <= 1) return;
    autoSlideInterval.current = setInterval(() => {
      let nextIndex = activeIndex + 1;
      if (nextIndex >= stations.length) nextIndex = 0;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }, 5000);
    return () => clearInterval(autoSlideInterval.current);
  }, [stations.length, activeIndex]);

  const onScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_MARGIN));
    if (index !== activeIndex) setActiveIndex(index);
  };

  const goToPrev = () => {
    let prevIndex = activeIndex - 1;
    if (prevIndex < 0) prevIndex = stations.length - 1;
    flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    setActiveIndex(prevIndex);
  };

  const goToNext = () => {
    let nextIndex = activeIndex + 1;
    if (nextIndex >= stations.length) nextIndex = 0;
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setActiveIndex(nextIndex);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStations();
    setRefreshing(false);
  };

  const sortStations = (stationsList) => {
    const sorted = [...stationsList];
    switch(sortOption) {
      case 'distance':
        sorted.sort((a, b) => (a.distance || 999) - (b.distance || 999));
        break;
      case 'price':
        sorted.sort((a, b) => a.hourly_rate - b.hourly_rate);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  };

  const filtered = stations
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    .map(s => ({ ...s, distance: loc ? getDistance(loc.latitude, loc.longitude, s.lat, s.lng) : null }));
  const sortedStations = sortStations(filtered);

  const getVehicleIcon = () => {
    switch (vehicleType) {
      case 'car': return <Car size={14} color={colors.teal} />;
      case 'motorcycle': return <Bike size={14} color={colors.teal} />;
      case 'truck': return <Truck size={14} color={colors.teal} />;
      default: return <Car size={14} color={colors.teal} />;
    }
  };

  const renderStationCard = ({ item }) => {
    const avail = item.available_slots, total = item.total_slots;
    const col = slotColor(avail, total, colors);
    const statusKey = avail === 0 ? 'stationDetail.lotFull' : avail < 5 ? 'stationDetail.almostFull' : 'stationDetail.available';
    const distanceText = item.distance ? `${item.distance.toFixed(1)} km` : '? km';

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.getParent()?.navigate('StationDetail', { station: item })}
        style={[styles.cardContainer, { backgroundColor: colors.bg2, borderColor: colors.border }]}
      >
        {/* LARGER IMAGE SECTION */}
        <View style={styles.imageWrapper}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={[styles.cardImage, styles.imagePlaceholder, { backgroundColor: colors.bg1 }]}>
              <Text style={[styles.placeholderText, { color: colors.teal }]}>🅿️</Text>
              <Text style={[styles.placeholderSmall, { color: colors.t3 }]}>Parking</Text>
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.stationName, { color: colors.t1 }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.stationAddress, { color: colors.t2 }]} numberOfLines={1}>
            <MapPin size={12} color={colors.t3} /> {item.address}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.availability}>
              <Text style={[styles.availabilityCount, { color: col }]}>{avail}/{total}</Text>
              <Text style={[styles.availabilityLabel, { color: colors.t3 }]}>spots</Text>
            </View>
            <Pill label={statusKey} type={avail === 0 ? 'danger' : avail < 5 ? 'warning' : 'success'} size="sm" />
            <View style={[styles.distChip, { backgroundColor: colors.bg1, borderColor: colors.border }]}>
              <MapPin size={10} color={colors.t2} />
              <Text style={[styles.distText, { color: colors.t2 }]}> {distanceText}</Text>
            </View>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.rate, { color: colors.gold }]}>{item.hourly_rate} ETB</Text>
            <Text style={[styles.rateUnit, { color: colors.t3 }]}>/hr</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <Loader />;

  const renderPagination = () => {
    if (sortedStations.length <= 1) return null;
    return (
      <View style={styles.paginationContainer}>
        {sortedStations.map((_, idx) => (
          <View
            key={idx}
            style={[styles.paginationDot, { backgroundColor: colors.t3 }, activeIndex === idx && { backgroundColor: colors.teal, width: 20 }]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
      >
        <View style={[styles.hero, { backgroundColor: colors.bg0 }]}>
          <View style={[styles.heroBlob, { backgroundColor: colors.tealGlow }]} />
          <View style={styles.heroTop}>
            <View>
              <Text style={[styles.greeting, { color: colors.t2 }]}>{t('home.greeting')} </Text>
              <Text style={[styles.userName, { color: colors.t1 }]}>{userName}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('Notifications')} style={[styles.notifBtn, { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: colors.border }]}>
              <Bell size={20} color={colors.t1} />
              <View style={[styles.notifBadge, { backgroundColor: colors.red }]} />
            </TouchableOpacity>
          </View>
          <View style={[styles.searchWrap, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: colors.border }]}>
            <Search size={16} color={colors.t3} />
            <TextInput
              style={[styles.searchInput, { color: colors.t1 }]}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor={colors.t3}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={{ color: colors.t3, fontSize: 18, fontWeight: '300' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.body}>
          <TouchableOpacity 
            onPress={() => navigation.getParent()?.navigate('QrScanner')}
            style={[styles.qrButton, { backgroundColor: colors.teal }]}
          >
            <QrCode size={20} color="#060B18" />
            <Text style={styles.qrButtonText}>Quick gate access</Text>
          </TouchableOpacity>

          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.t1 }]}>Recommended Parkings</Text>
            <TouchableOpacity onPress={() => setShowSortMenu(true)}>
              <Text style={[styles.seeAll, { color: colors.teal }]}>See All &gt;</Text>
            </TouchableOpacity>
          </View>

          {sortedStations.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 52 }}>🅿️</Text>
              <Text style={[styles.emptyTitle, { color: colors.t1 }]}>No Stations Found</Text>
              <Text style={[styles.emptyText, { color: colors.t2 }]}>Try a different search or vehicle type</Text>
            </View>
          ) : (
            <>
              <FlatList
                ref={flatListRef}
                data={sortedStations}
                renderItem={renderStationCard}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + CARD_MARGIN}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 20 }}
                onMomentumScrollEnd={onScrollEnd}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: false }
                )}
                style={{ marginBottom: 8 }}
              />
              {renderPagination()}
              {sortedStations.length > 1 && (
                <View style={styles.carouselArrows}>
                  <TouchableOpacity onPress={goToPrev} style={[styles.arrowBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                    <ChevronLeft size={20} color={colors.t1} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={goToNext} style={[styles.arrowBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                    <ChevronRight size={20} color={colors.t1} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showSortMenu} transparent animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSortMenu(false)}>
          <View style={[styles.sortModal, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setSortOption('distance'); setShowSortMenu(false); }} style={styles.sortOption}>
              <Text style={[styles.sortOptionText, { color: colors.t1 }]}>📍 {t('home.distance')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSortOption('price'); setShowSortMenu(false); }} style={styles.sortOption}>
              <Text style={[styles.sortOptionText, { color: colors.t1 }]}>💰 {t('home.price')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSortOption('name'); setShowSortMenu(false); }} style={styles.sortOption}>
              <Text style={[styles.sortOptionText, { color: colors.t1 }]}>🔤 {t('home.name')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSortMenu(false)} style={styles.sortCancel}>
              <Text style={[styles.sortCancelText, { color: colors.t3 }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20, overflow: 'hidden' },
  heroBlob: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -150, right: -80 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  greeting: { fontSize: 14, fontWeight: '600' },
  userName: { fontSize: 26, fontWeight: '900', letterSpacing: -0.8, marginTop: 2 },
  notifBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative', borderWidth: 1 },
  notifBadge: { position: 'absolute', width: 10, height: 10, borderRadius: 5, top: 8, right: 8, borderWidth: 2, borderColor: '#000' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 14 },
  body: { padding: 20, paddingBottom: 36 },
  qrButton: { padding: 14, borderRadius: 12, marginBottom: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  qrButtonText: { color: '#060B18', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  seeAll: { fontSize: 13, fontWeight: '600' },
  cardContainer: {
    width: CARD_WIDTH,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: CARD_MARGIN,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  imageWrapper: { width: '100%', height: 200 }, // LARGER IMAGE HEIGHT (was 160)
  cardImage: { width: '100%', height: 200, resizeMode: 'cover' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 48 },
  placeholderSmall: { fontSize: 12, marginTop: 4 },
  cardContent: { padding: 14 },
  stationName: { fontSize: 18, fontWeight: '900' },
  stationAddress: { fontSize: 12, marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  availability: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  availabilityCount: { fontSize: 16, fontWeight: '900' },
  availabilityLabel: { fontSize: 11, fontWeight: '500' },
  distChip: { borderRadius: 100, paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  distText: { fontSize: 11, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  rate: { fontSize: 18, fontWeight: '900' },
  rateUnit: { fontSize: 11, marginLeft: 2 },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 12 },
  paginationDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  carouselArrows: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 },
  arrowBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  empty: { alignItems: 'center', paddingVertical: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  emptyText: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  sortModal: { borderRadius: 16, padding: 16, width: '80%', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sortOption: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  sortOptionText: { fontSize: 15, fontWeight: '500' },
  sortCancel: { paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', marginTop: 4 },
  sortCancelText: { fontSize: 15, fontWeight: '600' },
});