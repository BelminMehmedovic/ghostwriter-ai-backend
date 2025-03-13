const firebase = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

// Replace with your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCdmxTftYQg9KQzrvZPJi1fbHCDkXrgKrs",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = getAuth();

async function getToken() {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, "belmin-m@outlook.de", "Justversace2019.");
    const idToken = await userCredential.user.getIdToken();
    console.log("ID Token:", idToken);
  } catch (error) {
    console.error("Error signing in:", error);
  }
}

getToken();