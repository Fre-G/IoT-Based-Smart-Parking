# IoT-Based Smart Parking Management System Mobile App

A cross-platform mobile application built with React Native and Expo, serving as the driver-facing client for a comprehensive smart parking ecosystem. The app connects drivers with real-time parking data, automated slot tracking, and seamless booking workflows.

## System Architecture Overview
This mobile app is part of a larger end-to-end IoT solution designed for urban parking management
* Mobile App (Driver Client): Handles user registration, location-based station discovery, slot booking, active session tracking, and payments.
* Web Dashboard (Admins & Attendants): Manages station metrics, confirms bookings, and oversees lot operations.
* IoT Hardware Layer (ESP32 & Sensors): Utilizes microcontrollers, ultrasonic/IR sensors for vehicle detection, and automated gates to sync real-time availability to the cloud database.

## Key Features Built
* Smart Location & Discovery: Secure user authentication flows, profile registration, and location-services integration to find and navigate to the nearest available parking stations.
* Booking & Session Management: Interactive slot selection, live booking management, and active parking session monitoring with countdowns/timers.
* Hardware & Device Integration: QR code scanning for fast, contactless gate check-ins, automated push notifications for booking updates, and secure local session storage.
* Localization: Full multi-language support (English and Amharic) powered by `i18next` to cater to local drivers.

 Tech Stack
* Framework: React Native, Expo, Expo Router / Stack Navigator
* State & Storage: React Context, Async Storage, Firebase Realtime Database/Firestore
* UI & Utilities: Lucide icons, custom theme provider, safe area context, i18next for localization

Built with clean architecture, component separation, and real-time cloud synchronization.
