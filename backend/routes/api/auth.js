// routes/api/auth.js
import express from "express";
import crypto from "crypto";
import { loadCredentialsFromDB } from "../../credentials.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const { owner, admins, marketing } = await loadCredentialsFromDB();

  let role = null;

  // ✅ ตรวจสอบสิทธิ์
  if (owner.username === username && owner.password === password) {
    role = "OWNER";
  } else if (admins.some(a => a.username === username && a.password === password)) {
    role = "ADMIN";
  } else if (marketing.some(m => m.username === username && m.password === password)) {
    role = "MARKETING";
  }

  if (role) {
    // ✅ เก็บข้อมูล session เฉพาะที่จำเป็น
    req.session.user = {
      username,
      role,
      loginAt: Date.now()
    };

    console.log(`✅ Login สำเร็จ: ${username} (${role}) → sessionID: ${req.sessionID}`);
    return res.redirect("/");
  }

  return res.redirect("/login?error=1");
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

export default router;