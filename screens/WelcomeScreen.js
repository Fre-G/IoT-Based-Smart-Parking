import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const CAROUSEL_HEIGHT = height * 0.58;
const SLIDE_WIDTH = width;

const SLIDES = [
  { id: '1', image: require('../assets/welcome/slide1.png') },
  { id: '2', image: require('../assets/welcome/slide2.png') },
  { id: '3', image: require('../assets/welcome/slide3.png') },
  { id: '4', image: require('../assets/welcome/slide4.png') },
  { id: '5', image: require('../assets/welcome/slide5.png') },
];

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const flatListRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = activeIndex === SLIDES.length - 1 ? 0 : activeIndex + 1;
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      setActiveIndex(nextIndex);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeIndex]);

  const onScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setActiveIndex(index);
  };

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <Image source={item.image} style={styles.slideImage} />
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* Image Slider */}
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
        />

        <View style={styles.paginationContainer}>
          {SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.paginationDot,
                activeIndex === idx && {
                  width: 20,
                  backgroundColor: colors.teal,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Bottom Content */}
      <View style={styles.contentContainer}>
        <View>
          <Text style={styles.logoText}>
            Gondar<Text style={{ color: colors.teal }}>Parking</Text>
          </Text>

          <Text style={styles.mainTitle}>Find and pay for parking</Text>

          <Text style={styles.description}>
            Search for parking locations that support QR code access and enjoy seamless parking.
          </Text>
        </View>

        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.teal }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.actionButtonText}>Log in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.teal }]}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.actionButtonText}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  carouselContainer: {
    height: CAROUSEL_HEIGHT,
  },

  slide: {
    width: SLIDE_WIDTH,
    height: CAROUSEL_HEIGHT,
  },

  slideImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  paginationContainer: {
    position: 'absolute',
    bottom: 15,
    alignSelf: 'center',
    flexDirection: 'row',
  },

  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 5,
  },

  contentContainer: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 30,
    paddingTop: 20,
    justifyContent: 'space-between',
    paddingBottom: 35,
  },

  logoText: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    marginBottom: 25,
  },

  mainTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 42,
    marginBottom: 12,
  },

  description: {
    color: '#BDBDBD',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },

  buttonsRow: {
    flexDirection: 'row',
    gap: 15,
  },

  actionButton: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '700',
  },
});