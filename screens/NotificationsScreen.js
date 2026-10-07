import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, R, Sh } from '../theme';

export default function NotificationsScreen({ navigation }) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem('app_notifications');
      if (stored) {
        setNotifications(JSON.parse(stored));
      } else {
        setNotifications([
          { id: '1', title: t('notifications.welcomeTitle'), body: t('notifications.welcomeBody'), timestamp: new Date().toISOString(), read: false },
          { id: '2', title: t('notifications.tipTitle'), body: t('notifications.tipBody'), timestamp: new Date().toISOString(), read: false },
        ]);
      }
    } catch (error) {
      console.error('Failed to load notifications', error);
    }
  };

  const markAsRead = async (id) => {
    const updated = notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    await AsyncStorage.setItem('app_notifications', JSON.stringify(updated));
  };

  const clearAll = async () => {
    Alert.alert(
      t('notifications.clearTitle'),
      t('notifications.clearMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('notifications.clear'), onPress: async () => {
            setNotifications([]);
            await AsyncStorage.removeItem('app_notifications');
          }
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.unread]}
      onPress={() => markAsRead(item.id)}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
      <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg0} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.titleHeader}>{t('notifications.title')}</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Text style={styles.clearText}>{t('notifications.clearAll')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>🔔</Text>
          <Text style={styles.emptyTitle}>{t('notifications.noNotifications')}</Text>
          <Text style={styles.emptyText}>{t('notifications.allCaughtUp')}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, borderRadius: R.md, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backArrow: { color: C.t1, fontSize: 20 },
  titleHeader: { fontSize: 20, fontWeight: '900', color: C.t1 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.bg2, borderRadius: R.md },
  clearText: { color: C.teal, fontSize: 13, fontWeight: '700' },
  list: { padding: 20, paddingBottom: 36 },
  card: { backgroundColor: C.bg2, borderRadius: R.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, ...Sh.soft },
  unread: { borderLeftWidth: 4, borderLeftColor: C.teal, backgroundColor: C.bg3 },
  title: { fontSize: 16, fontWeight: '800', color: C.t1, marginBottom: 6 },
  body: { fontSize: 14, color: C.t2, marginBottom: 8 },
  time: { fontSize: 11, color: C.t3 },
  empty: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: C.t1, marginTop: 14, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.t2 },
});