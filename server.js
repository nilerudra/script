import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(cors());

// Serve static files
app.use(express.static("public"));

// Global variables
const EVENTS = [];
const USERS = {};

// Verify Shopify proxy
function verifyShopifyProxy(req) {
  const { signature, hmac, ...query } = req.query;
  const received = signature || hmac;

  const message = Object.keys(query)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join("");

  const generated = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");

  return generated === received;
}

// Update user profile
function updateUserProfile(event) {
  const { userId, shop, type, timestamp } = event;

  if (!USERS[userId]) {
    USERS[userId] = {
      userId,
      shop,
      visits: 0,
      eventsCount: 0,
      lastSeen: null,
      createdAt: new Date(),
    };
  }

  USERS[userId].eventsCount += 1;
  USERS[userId].lastSeen = new Date(timestamp);

  // Count visits (example logic)
  if (type === "checkout_clicked") {
    USERS[userId].visits += 1;
  }
}

// Get shop details
async function getShopDetails(shop, accessToken) {
  const query = `
    query {
      shop {
        id
        name
        email
        myshopifyDomain
        currencyCode
        primaryDomain {
          url
        }
        plan {
          displayName
        }
        ianaTimezone
        weightUnit
      }
    }
  `;

  const res = await axios.post(
    `https://${shop}/admin/api/2025-10/graphql.json`,
    { query },
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    },
  );

  if (res.data.errors) {
    throw new Error(JSON.stringify(res.data.errors));
  }

  return res.data.data.shop;
}

app.get("/script.js", (req, res) => {
  res.sendFile(__dirname + "/script.js");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Checkout
app.post("/checkout/session", async (req, res) => {
  try {
    if (!verifyShopifyProxy(req)) {
      return res.status(401).json({ error: "Invalid proxy request" });
    }

    const shop = req.query.shop;
    const { cart } = req.body;
    const token = process.env.ACCESS_TOKEN;

    // Validations
    if (!cart) {
      return res.status(400).json({ error: "Cart missing" });
    }

    if (!shop) {
      return res.status(400).json({ error: "Shop missing" });
    }

    if (!token) {
      return res.status(500).json({ error: "ACCESS_TOKEN missing" });
    }

    console.log("Shop:", shop);
    console.log("Cart:", cart);

    // Fetches Shopify store details
    const shopDetails = await getShopDetails(shop, token);

    console.log("Shop Name:", shopDetails);

    const sessionId = Date.now();

    // Fix for Render proxy (important)
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const baseUrl = `${protocol}://${req.get("host")}`;

    res.json({
      shopDetails: shopDetails,
      url: `${baseUrl}/checkout.html?session=${sessionId}`,
    });
  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message || err);

    res.status(500).json({
      error: "Internal Server Error",
    });
  }
});

// Track events
app.post("/track", (req, res) => {
  try {
    // Verify Shopify proxy request
    if (!verifyShopifyProxy(req)) {
      return res.status(401).json({ error: "Invalid proxy request" });
    }

    const shop = req.query.shop;

    const { userId, type, data, timestamp } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const event = {
      shop,
      userId,
      type,
      data: data || {},
      timestamp: timestamp || Date.now(),
    };

    // Store event
    EVENTS.push(event);

    // Update user profile
    updateUserProfile(event);

    console.log("Tracked Event:", event);

    res.json({ success: true });
  } catch (err) {
    console.error("Track error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/debug/events", (req, res) => {
  res.json(EVENTS);
});

app.get("/debug/users", (req, res) => {
  res.json(USERS);
});

app.listen(3000, () => {
  console.log("Server running");
});
