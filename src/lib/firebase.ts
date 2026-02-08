import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCSoakrWby20FMjcAtdq7BZjcEnDFTCa6w",
  authDomain: "futurecraftmanagament.firebaseapp.com",
  projectId: "futurecraftmanagament",
  storageBucket: "futurecraftmanagament.firebasestorage.app",
  messagingSenderId: "831632018240",
  appId: "1:831632018240:web:50e07c422c0c568103c8a5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Usa la stessa regione dove hai fatto deploy della funzione (europe-west1)
const functions = getFunctions(app, "europe-west1");
export const createClientUserCallable = httpsCallable<{ email: string; password: string; displayName?: string; maxBookingsPerMonth?: number }, { uid: string; email: string; message: string }>(functions, "createClientUser");
