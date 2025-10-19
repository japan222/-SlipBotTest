// routes/api/settings.js
import { loadSettings, saveSettings, reloadSettings } from "../../utils/settingsManager.js";
import express from "express";

const router = express.Router();

router.get('/settings', async (req, res) => {
  try {
    const settings = await loadSettings(); // 👉 โหลดจาก MongoDB
    if (!settings) throw new Error("ไม่พบ settings");

    // แปลง ms → s สำหรับ frontend
    res.json({
      ...settings,
      timeLimit: settings.timeLimit / 1000,
      sameQrTimeLimit: settings.sameQrTimeLimit / 1000
    });
  } catch (err) {
    console.error("❌ โหลด settings ไม่สำเร็จ:", err.message);
    res.status(500).json({ error: "โหลด settings ไม่สำเร็จ" });
  }
});

router.post('/settings', async (req, res) => {
  try {
    await saveSettings(req.body); // 👉 บันทึกลง MongoDB
    await reloadSettings(); // 👉 โหลดใหม่เข้าตัวแปร global
    restartWebhooks();     // 👉 ถ้าจำเป็นต้องใช้ settings กับ webhook
    res.json({ success: true });
  } catch (err) {
    console.error("❌ บันทึก settings ไม่สำเร็จ:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;