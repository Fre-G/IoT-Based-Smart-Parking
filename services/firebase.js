import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';   

.
.
.
.
export const auth = firebase.auth();
export const db = firebase.firestore();
export const rtdb = firebase.database();   
