const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;

const initializeFirebase = () => {
  if (admin.apps.length > 0) {
    firebaseInitialized = true;
    return admin;
  }

  try {
    // Priority 1: Environment Variable (Production/Render)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized from environment variable');
    }
    // Priority 2: Local Service Account File (Development)
    else {
      const serviceAccountPath = path.join(__dirname, '..', 'middleware', 'serviceAccount.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        firebaseInitialized = true;
        console.log('✅ Firebase Admin initialized from file');
      } else {
        console.warn('⚠️ Firebase Admin: No credentials found. Notifications will be disabled.');
      }
    }
  } catch (error) {
    console.error('❌ Firebase Initialization Error:', error.message);
  }

  return admin;
};

module.exports = {
  admin,
  initializeFirebase,
  get isInitialized() { return firebaseInitialized; }
};

