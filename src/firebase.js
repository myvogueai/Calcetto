import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDQ57idD6xuG7K0LsNBViLuxiIkCdcZPFA",
  authDomain: "calcetto-5vs5.firebaseapp.com",
  projectId: "calcetto-5vs5",
  storageBucket: "calcetto-5vs5.firebasestorage.app",
  messagingSenderId: "314044322937",
  appId: "1:314044322937:web:f72a885a356b892b7c70a8",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
