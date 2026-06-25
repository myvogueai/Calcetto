import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ============================================================
// STEP 1: Incolla qui la tua configurazione Firebase
//
// Dove trovarla:
//   Firebase Console (console.firebase.google.com)
//   → Seleziona il tuo progetto
//   → Icona ingranaggio → Impostazioni progetto
//   → Scheda "Generali" → sezione "Le tue app"
//   → Clicca sull'app web (o creane una nuova con </> )
//   → Copia l'oggetto firebaseConfig qui sotto
// ============================================================
const firebaseConfig = {
  apiKey: "INSERISCI_QUI_LA_TUA_API_KEY",
  authDomain: "INSERISCI_IL_TUO_PROJECT_ID.firebaseapp.com",
  projectId: "INSERISCI_IL_TUO_PROJECT_ID",
  storageBucket: "INSERISCI_IL_TUO_PROJECT_ID.appspot.com",
  messagingSenderId: "INSERISCI_IL_TUO_MESSAGING_SENDER_ID",
  appId: "INSERISCI_IL_TUO_APP_ID",
};
// ============================================================

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
