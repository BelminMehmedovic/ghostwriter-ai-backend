const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore(); // Firestore reference

exports.authCheck = functions.https.onRequest(async (req, res) => {
    const idToken = req.headers.authorization && req.headers.authorization.split("Bearer ")[1];
    if (!idToken) {
        return res.status(401).json({ error: "Unauthorized – No token provided" });
    }

    try {
        // Verify ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // Fetch user subscription data from Firestore
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: "User not found in database" });
        }

        const userData = userDoc.data();
        const subscriptionStatus = userData.subscriptionStatus || "inactive"; // Default to inactive if missing
        const plan = userData.plan || "free"; // Default plan

        // Return subscription status
        return res.json({ subscriptionStatus, plan });
    } catch (error) {
        console.error("Error verifying auth token:", error);
        return res.status(403).json({ error: "Invalid token" });
    }
});