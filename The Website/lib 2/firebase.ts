import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyD5ntDf4dh1jxXXdkmPr1PD7AMm4aCHufk",
  authDomain: "knexflex-4848a.firebaseapp.com",
  projectId: "knexflex-4848a",
  storageBucket: "knexflex-4848a.firebasestorage.app",
  messagingSenderId: "47610877598",
  appId: "1:47610877598:web:37ae6366ef11d503d18d8f",
};

const app = initializeApp(firebaseConfig);

// 🔑 what we actually need
export const auth = getAuth(app);
export const db = getFirestore(app);



/*
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
*/