import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
