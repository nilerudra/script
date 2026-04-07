import dotenv from "dotenv";
dotenv.config();
import crypto from "crypto";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(cors());

// Serve static files
app.use(express.static("public"));

function verifySignature(body, signature) {
  const expected = crypto
    .createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");

  return expected === signature;
}

app.get("/script.js", (req, res) => {
  res.sendFile(__dirname + "/script.js");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/checkout/session", (req, res) => {
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

  const { cart, shop } = req.body;

  console.log("Verified request from:", shop);
  console.log("Cart:", cart);

  const sessionId = Date.now();
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.json({
    url: `${baseUrl}/checkout.html?session=${sessionId}`,
  });
});

app.listen(3000, () => {
  console.log("Server running");
});
