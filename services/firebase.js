import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';   

const firebaseConfig = {
  apiKey: "AIzaSyADQ3GBkisRU9KUYIDZS6b4fL5E1Axd3sY",
  authDomain: "smart-parking-dashboard-a7707.firebaseapp.com",
  projectId: "smart-parking-dashboard-a7707",
  storageBucket: "smart-parking-dashboard-a7707.firebasestorage.app",
  messagingSenderId: "993616491919",
  appId: "1:993616491919:web:a09889422f9ff906fc07fa",
  databaseURL: "https://smart-parking-dashboard-a7707-default-rtdb.firebaseio.com/"   
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const rtdb = firebase.database();   