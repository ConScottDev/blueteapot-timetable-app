// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBmTFyjIDS38HUz7_Pj8NKaFEzRlwDsPn0",

  authDomain: "bluetapot-scheduling-app.firebaseapp.com",

  projectId: "bluetapot-scheduling-app",

  storageBucket: "bluetapot-scheduling-app.firebasestorage.app",

  messagingSenderId: "342461627260",

  appId: "1:342461627260:web:77f74a6b1a62b90eb402f9",

  measurementId: "G-14LZYLLE0F",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app); // Initialize Firebase Authentication
const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1"); // match your region
export const callAdminUpsert = httpsCallable(functions, "adminUpsertAuthUserWithPassword");
export const callAdminDeleteUser = httpsCallable(functions, "adminDeleteUser"); // <-- add this

// Export the auth object for use in other parts of your application
export { auth, db };
export default app;
