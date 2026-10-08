
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { registerForPushNotificationsAsync, listenForNotifications } from './services/notifications';


import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import HomeScreen from './screens/HomeScreen';
import StationDetailScreen from './screens/StationDetailScreen';
import BookingListScreen from './screens/BookingListScreen';
import ActiveParkingScreen from './screens/ActiveParkingScreen';
import PaymentScreen from './screens/PaymentScreen';
import ProfileScreen from './screens/ProfileScreen';
import QrScannerScreen from './screens/QrScannerScreen';
import ParkingHistoryScreen from './screens/ParkingHistoryScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import VehiclesScreen from './screens/VehiclesScreen';
import PrivacySecurityScreen from './screens/PrivacySecurityScreen';
import HelpSupportScreen from './screens/HelpSupportScreen';

import './i18n';

// Lucide icons
import { Home, Calendar, User } from 'lucide-react-native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottomInset = insets.bottom || (Platform.OS === 'ios' ? 20 : 16);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg1,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 60 + bottomInset,
          paddingBottom: bottomInset > 0 ? bottomInset : 8,
        },
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.t3,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
        tabBarIconStyle: { marginTop: 6 },
      }}
    >
      <Tab.Screen
        name="Explore"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <Home size={22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingListScreen}
        options={{
          tabBarIcon: ({ color }) => <Calendar size={22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={1.8} />,
        }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const navigationRef = useRef();
  const { colors } = useTheme();

  useEffect(() => {
    registerForPushNotificationsAsync();
   
    const cleanup = listenForNotifications(navigationRef);
    return cleanup;
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
  
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="VerifyEmailScreen" component={VerifyEmailScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="StationDetail" component={StationDetailScreen} />
        <Stack.Screen name="ActiveParking" component={ActiveParkingScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="QrScanner" component={QrScannerScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="ParkingHistory" component={ParkingHistoryScreen} />
        <Stack.Screen name="Vehicles" component={VehiclesScreen} />
        <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
