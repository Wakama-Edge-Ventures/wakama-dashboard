// src/lib/firebaseClient.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDmfy51ifnm5JY-apixP_2nGlSeNLcqbik",
  authDomain: "wakama-rwa.firebaseapp.com",
  projectId: "wakama-rwa",
  storageBucket: "wakama-rwa.firebasestorage.app",
  messagingSenderId: "291714519242",
  appId: "1:291714519242:web:ca6cc3918c2a473705a433",
};

// évite d'initialiser deux fois si Next.js recharge
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
