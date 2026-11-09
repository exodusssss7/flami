// Copy to config.js and fill in your own values. config.js is gitignored.
// Firebase: Project settings > Your apps > Web app (free Spark plan is enough).
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_WEB_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// GIPHY: https://developers.giphy.com (free key). Leave empty to disable the GIF picker.
export const GIPHY_KEY = '';
// Metered TURN relay for calls on strict networks: https://www.metered.ca (free tier).
// Leave empty to use STUN only (calls may fail behind some mobile networks).
export const TURN_USERNAME = '';
export const TURN_CREDENTIAL = '';
