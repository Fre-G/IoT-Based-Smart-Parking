
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,      
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});


const sentNotificationIds = new Set();


const isExpoGo = () => Constants.appOwnership === 'expo';


export async function registerForPushNotificationsAsync() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Notifications Disabled', 'Enable notifications in Settings to receive booking updates.');
      return null;
    }

    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('smartpark_alerts', {
        name: 'SmartPark Alerts',
        importance: Notifications.AndroidImportance.MAX, // ← HEADS‑UP BANNER
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00E5C4',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      console.log(' Android notification channel created with MAX importance');
    }

    
    if (isExpoGo()) {
      console.log('📱 Expo Go: local notifications only (no FCM token)');
      return null;
    }

    
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        console.log('⚠️ No EAS projectId – push token skipped');
        return null;
      }
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      console.log('📲 Expo push token:', tokenData.data);
      return tokenData.data;
    } catch (tokenError) {
      console.log('⚠️ Push token skipped (FCM not configured):', tokenError.message);
      return null;
    }
  } catch (error) {
    console.log('⚠️ Notification setup (non‑fatal):', error.message);
    return null;
  }
}


async function saveNotification(notification) {
  try {
    const stored = await AsyncStorage.getItem('app_notifications');
    const existing = stored ? JSON.parse(stored) : [];
    const newNotif = {
      id: Date.now().toString(),
      ...notification,
      timestamp: new Date().toISOString(),
      read: false,
    };
    const updated = [newNotif, ...existing].slice(0, 50);
    await AsyncStorage.setItem('app_notifications', JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save notification:', error);
  }
}


export async function sendLocalNotification(title, body, data = {}, uniqueId = null) {
  // Prevent duplicate notifications
  const notifId = uniqueId || `${title}_${body}`;
  if (sentNotificationIds.has(notifId)) {
    console.log('🔁 Duplicate blocked:', title);
    return;
  }
  sentNotificationIds.add(notifId);
  setTimeout(() => sentNotificationIds.delete(notifId), 8000);

 
  await saveNotification({ title, body, data });

 
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        ...(Platform.OS === 'android' && {
          channelId: 'smartpark_alerts', // MUST match the channel created above
        }),
      },
      trigger: null, // ← IMMEDIATE DELIVERY – NO DELAY
    });
    console.log('✅ Notification POP‑UP sent:', title);
  } catch (err) {
    console.log('⚠️ Could not schedule notification:', err.message);

    // Fallback: try presenting it directly (works in some cases)
    try {
      await Notifications.presentNotificationAsync({
        title,
        body,
        data,
        sound: 'default',
        ...(Platform.OS === 'android' && {
          channelId: 'smartpark_alerts',
        }),
      });
      console.log('✅ Notification presented via fallback:', title);
    } catch (fallbackErr) {
      console.log('⚠️ Fallback also failed:', fallbackErr.message);
    }
  }
}


export function listenForNotifications(navigationRef) {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    console.log('📲 Notification tapped:', data);
    if (!navigationRef?.current) return;
    try {
      switch (data?.screen) {
        case 'BookingList':
        case 'Booking':
          navigationRef.current.navigate('Main', { screen: 'Booking' });
          break;
        case 'ActiveParking':
          navigationRef.current.navigate('ActiveParking', { session: { id: data.sessionId } });
          break;
        case 'Notifications':
          navigationRef.current.navigate('Notifications');
          break;
        default:
          navigationRef.current.navigate('Main', { screen: 'Booking' });
      }
    } catch (navError) {
      console.log('Navigation error from notification:', navError.message);
    }
  });

  
  return () => {
    if (subscription?.remove) subscription.remove();
  };
}


export async function clearAllNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem('app_notifications');
    sentNotificationIds.clear();
    console.log('🧹 Notifications cleared');
  } catch (error) {
    console.log('Failed to clear notifications:', error.message);
  }
}