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

// function verifySignature(body, signature) {
//   const generated = crypto
//     .createHash("sha256")
//     .update(JSON.stringify(body))
//     .digest("hex");

//   return generated === signature;
// }

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

async function getShopDetails(shop, accessToken) {
  const res = await axios.get(`https://${shop}/admin/api/2025-10/shop.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
    },
  });

  return res.data.shop;
}

app.get("/script.js", (req, res) => {
  res.sendFile(__dirname + "/script.js");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/proxy/checkout/session", async (req, res) => {
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

app.listen(3000, () => {
  console.log("Server running");
});
