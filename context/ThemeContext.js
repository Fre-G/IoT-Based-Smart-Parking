// context/ThemeContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true); // default dark (your existing theme)

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    const saved = await AsyncStorage.getItem('app_theme');
    if (saved !== null) {
      setIsDark(saved === 'dark');
    }
  };

  const toggleTheme = async () => {
    const newMode = !isDark;
    setIsDark(newMode);
    await AsyncStorage.setItem('app_theme', newMode ? 'dark' : 'light');
  };

  // Define light and dark color palettes
  const colors = {
    dark: {
      bg0: '#0A0F1C',   // main background
      bg1: '#111827',   // card background
      bg2: '#1E293B',   // elevated background
      bg3: '#334155',   // input background
      t1: '#FFFFFF',    // primary text
      t2: '#9CA3AF',    // secondary text
      t3: '#6B7280',    // tertiary text
      teal: '#00E5C4',  // accent
      tealGlow: '#00E5C420',
      tealBg: '#00E5C410',
      gold: '#FBBF24',
      green: '#10B981',
      red: '#EF4444',
      border: '#334155',
      inv: '#FFFFFF',
    },
    light: {
      bg0: '#F9FAFB',
      bg1: '#FFFFFF',
      bg2: '#F3F4F6',
      bg3: '#E5E7EB',
      t1: '#111827',
      t2: '#4B5563',
      t3: '#9CA3AF',
      teal: '#0D9488',
      tealGlow: '#0D948820',
      tealBg: '#0D948810',
      gold: '#D97706',
      green: '#059669',
      red: '#DC2626',
      border: '#E5E7EB',
      inv: '#FFFFFF',
    },
  };

  const themeColors = isDark ? colors.dark : colors.light;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors: themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);