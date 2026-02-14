// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getDatabase } from 'firebase/database';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDbGigDei6QdP64YSmEj89KAAaJgSjQYfA",
  authDomain: "friction-b30c6.firebaseapp.com",
  databaseURL: "https://friction-b30c6-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "friction-b30c6",
  storageBucket: "friction-b30c6.firebasestorage.app",
  messagingSenderId: "402376957247",
  appId: "1:402376957247:web:222777476a93bf5451878a",
  measurementId: "G-ZYF0Z5Q5TB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
