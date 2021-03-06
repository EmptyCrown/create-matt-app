import * as firebase from 'firebase/app';

import 'firebase/auth';

export function initialize() {
  firebase.initializeApp({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  });
}

export default firebase;
