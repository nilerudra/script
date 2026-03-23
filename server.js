import express from "express";

const app = express();

// Serve static files
app.use(express.static("public"));

app.get("/script.js", (req, res) => {
  res.sendFile(__dirname + "/public/script.js");
});

app.get("/index.html", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/checkout.html", (req, res) => {
  res.sendFile(__dirname + "/checkout.html");
});

app.listen(3000, () => {
  console.log("Server running");
});
