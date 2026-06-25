import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD-6yxzd4BX4vQIJ5ZLq77mbGl8Aau68_c",
  authDomain: "myvogueai.firebaseapp.com",
  projectId: "myvogueai",
  storageBucket: "myvogueai.firebasestorage.app",
  messagingSenderId: "356483710303",
  appId: "1:356483710303:web:e59a2287f2f5af409b4aea",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
