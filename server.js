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

function verifySignature(body, signature) {
  const generated = crypto
    .createHmac("sha256", process.env.SHARED_SECRET)
    .update(JSON.stringify(body))
    .digest("hex");

  return generated === signature;
}

async function getShopDetails(shop, accessToken) {
  const res = await axios.get(`https://${shop}/admin/api/2023-10/shop.json`, {
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

app.post("/checkout/session", async (req, res) => {
  const signature = req.headers["x-signature"];

  if (!signature || !verifySignature(req.body, signature)) {
    return res.status(401).json({
      error: "Invalid signature",
    });
  }

  if (!req.body || !req.body.cart) {
    return res.status(400).json({
      error: "Cart data missing",
    });
  }

  try {
    const { cart, shop } = req.body;

    console.log("Verified request from:", shop);
    console.log("Cart:", cart);

    const shopDetails = await getShopDetails(shop, process.env.ACCESS_TOKEN);

    console.log("Shop Name:", shopDetails.name);

    const sessionId = Date.now();
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.json({
      shopName: shopDetails.name,
      url: `${baseUrl}/checkout.html?session=${sessionId}`,
    });
  } catch (err) {
    console.error("Error getting shop details:", err);
    res.status(500).json({
      error: "Error getting shop details",
    });
  }
});

app.listen(3000, () => {
  console.log("Server running");
});
