import { initializeApp } from "firebase/app";
import {getAuth} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import {getStorage} from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCLBHL_z6PZKwh2PqylgtR7MWgxDn3XGS0",
  authDomain: "growfy-c8e21.firebaseapp.com",
  projectId: "growfy-c8e21",
  storageBucket: "growfy-c8e21.firebasestorage.app",
  messagingSenderId: "363750790858",
  appId: "1:363750790858:web:e5a577e8fa6c7a1afd0633"
};  
      

// Initialize Firebase
const app = initializeApp(firebaseConfig);  
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app