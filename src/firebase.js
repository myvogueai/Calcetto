import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Incolla qui il blocco firebaseConfig dalla Console Firebase
// (progetto calcetto-5vs5 → Impostazioni → Le tue app → app web)
const firebaseConfig = {
  apiKey: "INSERISCI_API_KEY",
  authDomain: "calcetto-5vs5.firebaseapp.com",
  projectId: "calcetto-5vs5",
  storageBucket: "calcetto-5vs5.firebasestorage.app",
  messagingSenderId: "INSERISCI_MESSAGING_SENDER_ID",
  appId: "INSERISCI_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
