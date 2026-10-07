import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Car, Calendar, Clock, DollarSign, FileText, CheckCircle, XCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { C, R, Sh } from '../theme';

export default function ParkingHistoryScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
     
      const q = query(
        collection(db, 'parkingSessions'),
        where('userId', '==', user.uid),
        where('status', 'in', ['completed', 'cancelled'])
      );
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
     
      data.sort((a, b) => {
        const dateA = a.bookingTime ? new Date(a.bookingTime) : new Date(0);
        const dateB = b.bookingTime ? new Date(b.bookingTime) : new Date(0);
        return dateB - dateA;
      });
      
      setHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
      
      if (error.code === 'failed-precondition') {
        try {
          const fallbackQuery = query(collection(db, 'parkingSessions'), where('userId', '==', user.uid));
          const fallbackSnapshot = await getDocs(fallbackQuery);
          let data = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          data = data.filter(item => item.status === 'completed' || item.status === 'cancelled');
          data.sort((a, b) => {
            const dateA = a.bookingTime ? new Date(a.bookingTime) : new Date(0);
            const dateB = b.bookingTime ? new Date(b.bookingTime) : new Date(0);
            return dateB - dateA;
          });
          setHistory(data);
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (entryTime, exitTime) => {
    if (!entryTime || !exitTime) return 'N/A';
    const entry = new Date(entryTime);
    const exit = new Date(exitTime);
    const diffMs = exit - entry;
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const HistoryCard = ({ item }) => {
    const isCompleted = item.status === 'completed';
    const StatusIcon = isCompleted ? CheckCircle : XCircle;
    const statusColor = isCompleted ? colors.green : colors.red;
    const duration = formatDuration(item.entryTime, item.exitTime);
    
    return (
      <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.stationIcon, { backgroundColor: colors.bg3 }]}>
            <Car size={20} color={colors.teal} />
          </View>
          <View style={styles.stationInfo}>
            <Text style={[styles.stationName, { color: colors.t1 }]}>{item.stationName || 'Unknown Station'}</Text>
            <View style={styles.statusBadge}>
              <StatusIcon size={12} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>{item.status || 'Unknown'}</Text>
            </View>
          </View>
          <Text style={[styles.amount, { color: colors.gold }]}>{item.totalFee || 0} ETB</Text>
        </View>
        
        <View style={[styles.detailsGrid, { backgroundColor: colors.bg1, borderColor: colors.border }]}>
          <View style={styles.detailItem}>
            <Calendar size={14} color={colors.t2} />
            <Text style={[styles.detailText, { color: colors.t1 }]}>{formatDate(item.bookingTime)}</Text>
            <Text style={[styles.detailLabel, { color: colors.t3 }]}>Date</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Clock size={14} color={colors.t2} />
            <Text style={[styles.detailText, { color: colors.t1 }]}>{formatTime(item.bookingTime)}</Text>
            <Text style={[styles.detailLabel, { color: colors.t3 }]}>Time</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <DollarSign size={14} color={colors.gold} />
            <Text style={[styles.detailText, { color: colors.gold }]}>{item.hourlyRate || 0} ETB</Text>
            <Text style={[styles.detailLabel, { color: colors.t3 }]}>/hour</Text>
          </View>
        </View>
        
        {(item.entryTime || item.exitTime) && (
          <View style={[styles.timeRow, { borderTopColor: colors.border }]}>
            {item.entryTime && (
              <View style={styles.timeItem}>
                <Text style={[styles.timeLabel, { color: colors.t3 }]}>Entry</Text>
                <Text style={[styles.timeValue, { color: colors.t2 }]}>{formatTime(item.entryTime)}</Text>
              </View>
            )}
            {duration !== 'N/A' && (
              <View style={styles.timeItem}>
                <Text style={[styles.timeLabel, { color: colors.t3 }]}>Duration</Text>
                <Text style={[styles.timeValue, { color: colors.teal }]}>{duration}</Text>
              </View>
            )}
            {item.exitTime && (
              <View style={styles.timeItem}>
                <Text style={[styles.timeLabel, { color: colors.t3 }]}>Exit</Text>
                <Text style={[styles.timeValue, { color: colors.t2 }]}>{formatTime(item.exitTime)}</Text>
              </View>
            )}
          </View>
        )}
        
        {item.vehiclePlate && (
          <View style={styles.plateRow}>
            <Car size={12} color={colors.t3} />
            <Text style={[styles.plateText, { color: colors.t2 }]}>{item.vehiclePlate}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg0 }]}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg0} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <ArrowLeft size={20} color={colors.t1} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.t1 }]}>Parking History</Text>
        <View style={{ width: 40 }} />
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.bg2 }]}>
            <FileText size={48} color={colors.t3} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.t1 }]}>No History</Text>
          <Text style={[styles.emptyText, { color: colors.t2 }]}>Your parking history will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={({ item }) => <HistoryCard item={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title: { fontSize: 20, fontWeight: 'bold' },
  list: { padding: 20, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, ...Sh.soft },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stationIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stationInfo: { flex: 1 },
  stationName: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  amount: { fontSize: 16, fontWeight: 'bold' },
  detailsGrid: { flexDirection: 'row', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1 },
  detailItem: { flex: 1, alignItems: 'center', gap: 4 },
  detailText: { fontSize: 13, fontWeight: '600' },
  detailLabel: { fontSize: 10, fontWeight: '600' },
  detailDivider: { width: 1, marginVertical: 4 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, marginTop: 4, borderTopWidth: 1 },
  timeItem: { alignItems: 'center', gap: 2 },
  timeLabel: { fontSize: 10, fontWeight: '600' },
  timeValue: { fontSize: 12, fontWeight: '500' },
  plateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  plateText: { fontSize: 12 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' },
});