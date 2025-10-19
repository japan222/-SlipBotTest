// index.js
import express from "express";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";

import { fileURLToPath } from "url";
import { connectDB } from "./mongo.js";

import { isAuthenticated } from "./middlewares/auth.js";
import { setupWebhooks } from "./routes/line-webhook.js";
import { broadcastLog } from "./utils/logManager.js";

import authRoutes from "./routes/api/auth.js";
import logsRoutes from "./routes/api/logs.js";
import bankRoutes from "./routes/api/bank.js";
import slipRoutes from "./routes/api/slip-results.js";
import shopRoutes from "./routes/api/shop.js";
import lineRoutes from "./routes/api/line-shop.js";
import settingsRoutes from "./routes/api/settings.js";
import imageRoutes from "./routes/api/line-images.js";
import statusRoutes from "./routes/api/status.js";
import phoneRoutes from "./routes/api/phone.js";
import messageRoutes from "./routes/api/send-message.js";

import BankAccount from "./models/BankAccount.js";

const envPath = path.join(process.cwd(), "info.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");

const PORT = process.env.PORT || 5000;

const clients = [];

const app = express();

// ตั้ง session ไว้ก่อนเสมอ
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 ชั่วโมง
}));

// ป้องกัน cache
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// Body parser
app.use("/webhook", express.raw({ type: "application/json" })); // อยู่บนสุดด
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static ที่ไม่ต้อง login
app.use(express.static(path.join(ROOT_DIR, "public")));
app.use("/views/css", express.static(path.join(ROOT_DIR, "views/css")));
app.use("/views/script", express.static(path.join(ROOT_DIR, "views/script")));

// ✅ หน้า login
app.get("/login", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "login.html"));
});

app.get("/", isAuthenticated, (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "views", "main.html"));
});

// สำหรับโหลดเนื้อหาย่อย เช่น dashboard.html ฯลฯ
app.get("/page/:name", isAuthenticated, (req, res) => {
  const name = req.params.name;
  const allowed = ["shop-setting", "dashboard", "settings", "logs", "send-message"];
  if (!allowed.includes(name)) {
    return res.status(404).send("ไม่พบหน้านี้");
  }
  res.sendFile(path.join(__dirname, "../views/pages", `${name}.html`));
});


app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  clients.push(res);

  req.on("close", () => {
    clients.splice(clients.indexOf(res), 1);
  });
});

app.get("/api/get-baseURL", (req, res) => {
  res.json({ URL: process.env.URL });
});

app.use("/api", logsRoutes);
app.use("/api", bankRoutes);
app.use("/api", slipRoutes);
app.use("/api", shopRoutes);
app.use("/api", lineRoutes);
app.use("/api", settingsRoutes);

app.use("/api", statusRoutes);
app.use("/api", phoneRoutes);

app.use("/api", messageRoutes);
app.use("/api", imageRoutes);

app.use("/", authRoutes);


process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET') {
    console.warn('⚠️ [uncaughtException] Connection reset by peer (ignored)');
    // ไม่ต้องปิดแอพ
  } else {
    console.error('❌ [uncaughtException]', err);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason.code === 'ECONNRESET') {
    console.warn('⚠️ [unhandledRejection] ECONNRESET (ignored)');
    // ไม่ crash
  } else {
    console.error('❌ [unhandledRejection]', reason);
  }
});

let bankAccounts = {};

export async function loadBankAccounts() {
  try {
    const all = await BankAccount.find();
    const grouped = {};
    for (const entry of all) {
      if (!grouped[entry.prefix]) grouped[entry.prefix] = [];
      grouped[entry.prefix].push({
        name: entry.name,
        account: entry.account,
        status: entry.status
      });
    }
    bankAccounts = grouped;
  } catch (err) {
    console.error("❌ โหลดบัญชีธนาคารล้มเหลว:", err.message);
    bankAccounts = {};
  }
}

// ให้เรียกใช้ตัวแปร global
export function getBankAccounts() {
  return bankAccounts;
}

export const restartWebhooks = async (app) => {
  console.log("พบการแก้ไขข้อมูล รีสตาร์ทบอทแล้ว...");
  broadcastLog("พบการแก้ไขข้อมูล รีสตาร์ทบอทแล้ว...");
  await loadBankAccounts();        // รอโหลดให้เสร็จจริง ๆ ก่อนใช้
  await setupWebhooks(app);           // รีเซ็ต webhook
};

(async () => {
  await connectDB();
  await loadBankAccounts();        // รอโหลดให้เสร็จก่อนบอททำงาน
  await setupWebhooks(app);           // รอ setup ให้เสร็จแน่ ๆ

  app.listen(PORT, () => {
    console.log(`🟢 กำลังทำงานที่พอร์ต ${PORT}`);
    broadcastLog(`🟢 กำลังทำงานที่พอร์ต ${PORT}`);
  });
})();
