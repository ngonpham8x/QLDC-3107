import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App with dynamic API key from environment variables
const effectiveApiKey =
  (import.meta as any).env?.VITE_FIREBASE_API_KEY ||
  (import.meta as any).env?.FIREBASE_API_KEY ||
  firebaseConfig.apiKey ||
  "";

const activeFirebaseConfig = {
  ...firebaseConfig,
  apiKey: effectiveApiKey
};

const app = initializeApp(activeFirebaseConfig);

// Initialize Firebase Auth safely
let authInstance: any = null;
try {
  authInstance = getAuth(app);
} catch (err) {
  console.warn("Firebase Auth could not be initialized:", err);
}
export const auth = authInstance;

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
export const googleAuthProvider = googleProvider;
