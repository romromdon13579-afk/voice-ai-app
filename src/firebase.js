import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBEzXtBZAo7NaCJtdOlquHgXzefEK-hsao",
  authDomain: "rome-123.firebaseapp.com",
  projectId: "rome-123",
  storageBucket: "rome-123.firebasestorage.app",
  messagingSenderId: "203487613407",
  appId: "1:203487613407:web:71506a86c5e7acc639346a",
  measurementId: "G-V5DGNJ70JH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export default app;
