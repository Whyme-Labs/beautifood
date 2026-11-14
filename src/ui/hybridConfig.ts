// Firebase project for the hybrid avoid reader (Firebase AI Logic). These values are public by
// design: Firebase web config and a reCAPTCHA site key ship in every page that uses them. What
// protects the Gemini API is App Check, enforced for AI Logic in the Firebase console.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA7HeN8gzlJLZdAvl-36rGSf5ft-mbspnE",
  authDomain: "beautifood-hybrid.firebaseapp.com",
  projectId: "beautifood-hybrid",
  storageBucket: "beautifood-hybrid.firebasestorage.app",
  messagingSenderId: "214333644919",
  appId: "1:214333644919:web:fb3a2cc6ef9be7af69a672",
  measurementId: "G-3ME639VLX0",
};

/**
 * The key App Check attests with on app.beautifood.io: a score-based Web key from Google Cloud Fraud
 * Defense (reCAPTCHA Enterprise), registered for this web app in Firebase App Check. Empty: the reader
 * stays off.
 */
export const RECAPTCHA_SITE_KEY = "6LcBhR8uAAAAAILVU37Kefhs7nsv_XmNteP3EdzU";
/** "enterprise" (Fraud Defense, what Firebase recommends) or "v3" (reCAPTCHA classic). */
export const RECAPTCHA_PROVIDER: "enterprise" | "v3" = "enterprise";

/** The cloud model the reader falls back to (Firebase AI Logic's default for hybrid). */
export const CLOUD_MODEL = "gemini-3.5-flash-lite";
