require("dotenv").config();
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

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

const PORT = process.env.PORT || 10000; // Render assigns a port, so we use process.env.PORT

// ✅ Added a root route to avoid "Cannot GET /" error
app.get("/", (req, res) => {
    res.send("✅ Ghostwriter Backend is Running!");
});

// ✅ Health Check Endpoint
app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
});

// Route to start Stripe checkout
app.post("/start-checkout", async (req, res) => {
    try {
        const { email, priceId } = req.body;

        if (!email || !priceId) {
            return res.status(400).json({ error: "Email and priceId are required" });
        }

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

// Route to check subscription status
app.post("/check-subscription", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const customers = await stripe.customers.list({ email });

        if (!customers.data.length) {
            return res.status(404).json({ error: "Customer not found" });
        }

        const customerId = customers.data[0].id;
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "active",
        });

        if (subscriptions.data.length === 0) {
            return res.status(403).json({ error: "No active subscription" });
        }

        res.json({ status: "active" });
    } catch (error) {
        console.error("Error checking subscription:", error);
        res.status(500).json({ error: "Failed to check subscription" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});