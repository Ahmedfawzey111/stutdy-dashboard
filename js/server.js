const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, "data.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/data", function (req, res) {
  fs.readFile(FILE, "utf8", function (err, text) {
    if (err) return res.json({});
    try {
      res.json(JSON.parse(text));
    } catch (error) {
      res.json({});
    }
  });
});

app.put("/api/data", function (req, res) {
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Invalid data" });
  }
  fs.writeFile(FILE, JSON.stringify(req.body), function (err) {
    if (err) return res.status(500).json({ error: "Save failed" });
    res.json({ ok: true });
  });
});

app.listen(PORT, function () {
  console.log("Running on http://localhost:" + PORT);
});