import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDQ57idD6xuG7K0LsNBViLuxiIkCdcZPFA",
  authDomain: "calcetto-5vs5.firebaseapp.com",
  projectId: "calcetto-5vs5",
  storageBucket: "calcetto-5vs5.firebasestorage.app",
  messagingSenderId: "314044322937",
  appId: "1:314044322937:web:f72a885a356b892b7c70a8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const GROUP_ID = "default";
const colPath = (key) => doc(db, "calcetto", `${GROUP_ID}__${key}`);

export const storage = {
  async get(key) {
    const snap = await getDoc(colPath(key));
    if (!snap.exists()) return null;
    return { key, value: snap.data().value };
  },
  async set(key, value) {
    await setDoc(colPath(key), { value });
    return { key, value };
  },
  subscribe(key, cb) {
    return onSnapshot(colPath(key), (snap) => {
      if (snap.exists()) cb({ key, value: snap.data().value });
    });
  },
};
