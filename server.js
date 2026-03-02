import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const app = express();
const PORT = process.env.PORT || 3030;

app.use(helmet());
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(express.static("public"));


if(!process.env.ADMIN_TOKEN) { process.env.ADMIN_TOKEN = crypto.randomUUID(); }
console.log(`Admin token: ${process.env.ADMIN_TOKEN}`);
// Basic rate limit for all routes
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Stricter limiter on submissions
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10, // per IP per hour
  message: { ok: false, error: "Too many submissions. Try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

const DATA_DIR = path.resolve("./data");
const DATA_FILE = path.join(DATA_DIR, "submissions.jsonl");
const VISITS_FILE = path.join(DATA_DIR, "visits.jsonl");
fs.mkdirSync(DATA_DIR, { recursive: true });

// Serve the form (query params like ?from=+15551234567 are read client-side for phisher tracking)
app.get("/", (_req, res) => {
  res.type("html").send(fs.readFileSync("./public/index.html", "utf8"));
});

// Record a visit (landing page hit) with fingerprint + optional phone from SMS link
app.post("/api/visit", (req, res) => {
  const phoneFromUrl = String(req.body.phone_from_url || "").trim();
  const fingerprint = req.body.fingerprint && typeof req.body.fingerprint === "object" ? req.body.fingerprint : {};
  const record = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ip: req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress || null,
    ua: req.headers["user-agent"] || null,
    phone_from_url: phoneFromUrl || null,
    ...fingerprint
  };
  fs.appendFileSync(VISITS_FILE, JSON.stringify(record) + "\n", "utf8");
  return res.json({ ok: true });
});

app.post("/api/submit", submitLimiter, (req, res) => {
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const purpose = String(req.body.purpose || "").trim();

  // Minimal validation
  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ ok: false, error: "Name must be 2–80 characters." });
  }
  if (phone.length < 7 || phone.length > 30) {
    return res.status(400).json({ ok: false, error: "Phone must be 7–30 characters." });
  }
  if (purpose.length < 5 || purpose.length > 500) {
    return res.status(400).json({ ok: false, error: "Purpose must be 5–500 characters." });
  }

  let fingerprint = {};
  if (req.body.fingerprint) {
    if (typeof req.body.fingerprint === "object") fingerprint = req.body.fingerprint;
    else if (typeof req.body.fingerprint === "string") {
      try { fingerprint = JSON.parse(req.body.fingerprint); } catch (_) {}
    }
  }
  const record = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ip: req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress || null,
    ua: req.headers["user-agent"] || null,
    name,
    phone,
    purpose,
    ...fingerprint
  };

  fs.appendFileSync(DATA_FILE, JSON.stringify(record) + "\n", "utf8");
  return res.json({ ok: true });
});

// Simple viewer endpoints (protect in real deployments!)
app.get("/admin/submissions", (req, res) => {
  const token = req.query.token;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).type("text").send("Unauthorized");
  }
  if (!fs.existsSync(DATA_FILE)) return res.json([]);
  const lines = fs.readFileSync(DATA_FILE, "utf8").trim().split("\n").filter(Boolean);
  res.json(lines.map((l) => JSON.parse(l)));
});

app.get("/admin/visits", (req, res) => {
  const token = req.query.token;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).type("text").send("Unauthorized");
  }
  if (!fs.existsSync(VISITS_FILE)) return res.json([]);
  const lines = fs.readFileSync(VISITS_FILE, "utf8").trim().split("\n").filter(Boolean);
  res.json(lines.map((l) => JSON.parse(l)));
});

app.listen(PORT, () => {
  console.log(`Contact intake running on http://localhost:${PORT}`);
});
