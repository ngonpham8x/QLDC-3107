import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Suppress benign Firestore gRPC idle stream connection warnings in iframe sandboxes
const suppressBenignFirestoreWarnings = () => {
  const isBenign = (msg: string) => 
    msg.includes("Disconnecting idle stream") || 
    msg.includes("GrpcConnection RPC 'Listen'") || 
    msg.includes("Timed out waiting for new targets") ||
    msg.includes("CANCELLED") ||
    msg.includes("Database is closing") ||
    msg.includes("Database is hidden") ||
    msg.includes("IndexedDB") ||
    msg.includes("IDBDatabase") ||
    msg.includes("Internal error");

  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(" ");
    if (isBenign(msg)) return;
    originalConsoleError(...args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(" ");
    if (isBenign(msg)) return;
    originalConsoleWarn(...args);
  };
};

suppressBenignFirestoreWarnings();

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

// Initialize Firestore with specific database ID if present, using long polling to avoid gRPC stream timeouts in sandboxed environments
export const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  (firebaseConfig as any).firestoreDatabaseId || "ai-studio-qunldnctdnph-da7c9d3e-909a-4207-ae73-55f5dd117cea"
);

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

// In-memory access token cache
let cachedAccessToken: string | null = null;

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Export helper to login with Google via Firebase Popup and cache token
export const loginWithGooglePopup = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return {
      user: result.user,
      accessToken: credential?.accessToken || null
    };
  } catch (error) {
    console.error("Firebase Google Sign-In Error:", error);
    throw error;
  }
};

