require("dotenv").config();
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");
const { Configuration, OpenAIApi } = require("openai");

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS || "{}");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// ✅ Root route
app.get("/", (req, res) => {
    res.send("✅ Ghostwriter Backend is Running!");
});

// ✅ Health Check Endpoint
app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
});

// ✅ Debug Token Route
app.get("/debugToken", async (req, res) => {
    const idToken = req.headers.authorization && req.headers.authorization.split("Bearer ")[1];
    if (!idToken) return res.status(401).json({ error: "Unauthorized – No token provided" });

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return res.json(decodedToken);
    } catch (error) {
        console.error("Error decoding auth token:", error);
        return res.status(403).json({ error: "Invalid token" });
    }
});

// ✅ Firebase Auth Check Route
app.get("/authCheck", async (req, res) => {
    const idToken = req.headers.authorization && req.headers.authorization.split("Bearer ")[1];
    if (!idToken) return res.status(401).json({ error: "Unauthorized – No token provided" });

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const db = admin.firestore();
        const userDoc = await db.collection("users").doc(userId).get();

        if (!userDoc.exists) return res.status(404).json({ error: "User not found in database" });

        const userData = userDoc.data();
        return res.json({
            subscriptionStatus: userData.subscriptionStatus || "inactive",
            plan: userData.plan || "free",
        });
    } catch (error) {
        console.error("Error verifying auth token:", error);
        return res.status(403).json({ error: "Invalid token" });
    }
});

// ✅ Start Stripe Checkout
app.post("/start-checkout", async (req, res) => {
    try {
        const { email, priceId } = req.body;
        if (!email || !priceId) return res.status(400).json({ error: "Email and priceId are required" });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            customer_email: email,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: "https://yourdomain.com/checkout-success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url: "https://yourdomain.com/checkout-cancel",
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("Error creating Stripe checkout session:", error);
        res.status(500).json({ error: "Failed to start checkout" });
    }
});

// ✅ Check Subscription Status (AI-Only w/ Logging)
app.post("/check-subscription", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const customers = await stripe.customers.list({ email });
        if (!customers.data.length) return res.status(404).json({ error: "Customer not found" });

        const customerId = customers.data[0].id;
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "active",
            expand: ["data.items"],
        });

        // 🧾 Log subscriptions for debugging
        console.log(`🧾 Subscriptions for ${email}:`);
        subscriptions.data.forEach((sub, index) => {
            sub.items.data.forEach((item) => {
                console.log(`👉 Sub ${index + 1}: price_id=${item.price.id}`);
            });
        });

        // ✅ Only allow these AI price IDs
        const aiPriceIds = [
            "price_1RAAUK5EH8G52S7ifhD9VhcI", // AI Monthly
            "price_1RAAUuKEH8G52S7izY10PITb"  // AI Yearly
        ];

        const hasAISubscription = subscriptions.data.some(sub =>
            sub.items.data.some(item => aiPriceIds.includes(item.price.id))
        );

        if (!hasAISubscription) {
            console.warn("❌ No valid AI subscription found.");
            return res.status(403).json({ error: "No active AI subscription" });
        }

        res.json({ status: "active" });
    } catch (error) {
        console.error("❌ Error checking subscription:", error);
        res.status(500).json({ error: "Failed to check subscription" });
    }
});

// ✅ OpenAI Endpoint
app.post("/generateAI", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-4.5-preview",
            messages: [
                { role: "system", content: "You're a helpful assistant who writes with clarity and a friendly tone." },
                { role: "user", content: prompt }
            ]
        });

        const answer = completion.data.choices?.[0]?.message?.content?.trim();
        res.json({ status: "success", text: answer });
    } catch (err) {
        console.error("OpenAI error:", err.response?.data || err.message);
        res.status(500).json({ status: "error", message: err.message });
    }
});

// ✅ Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});