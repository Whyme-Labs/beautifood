// Firebase project for the hybrid avoid reader (Firebase AI Logic). These values are public by
// design: Firebase web config and a reCAPTCHA site key ship in every page that uses them. What
// protects the Gemini API is App Check, enforced for AI Logic in the Firebase console.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA7HeN8gzlJLZdAvl-36rGSf5ft-mbspnE",
  authDomain: "beautifood-hybrid.firebaseapp.com",
  projectId: "beautifood-hybrid",
  storageBucket: "beautifood-hybrid.firebasestorage.app",
  messagingSenderId: "214333644919",
  appId: "1:214333644919:web:c75426f6c7beaaf369a672",
  measurementId: "G-4VBM83Y8EN",
};

/**
 * The key App Check attests with on app.beautifood.io: a score-based Web key from Google Cloud Fraud
 * Defense (reCAPTCHA Enterprise), registered for this web app in Firebase App Check. Empty: the reader
 * stays off.
 */
export const RECAPTCHA_SITE_KEY = "6LczfSAuAAAAALwRntuvbdyiOVSBjxH-V7b3O70h";
/** "enterprise" (Fraud Defense, what Firebase recommends) or "v3" (reCAPTCHA classic). */
export const RECAPTCHA_PROVIDER: "enterprise" | "v3" = "enterprise";

/** The cloud model the reader falls back to (Firebase AI Logic's default for hybrid). */
export const CLOUD_MODEL = "gemini-3.5-flash-lite";
/**
 * The cloud models a reading may be compared on (/hybrid?model=…), each with its lowest thinking
 * level: Flash-Lite thinks "minimal" by default; 3.8 Flash and 4 Hydrogen go no lower than "low".
 */
export const CLOUD_MODELS: Record<string, "MINIMAL" | "LOW"> = {
  "gemini-3.5-flash-lite": "MINIMAL",
  "gemini-3.8-flash": "LOW",
  "gemini-4-hydrogen": "LOW",
};
