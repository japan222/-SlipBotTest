// routes/api/line.js
import Shop from "../../models/Shop.js";
import { restartWebhooks } from "../../index.js";
import express from "express";

const router = express.Router();

// API สำหรับเพิ่มบัญชี LINE ใหม่เข้าไปในร้านค้า
router.post("/add-line", async (req, res) => {
  const { prefix, linename, access_token, secret_token, channel_id } = req.body;

  if (!prefix || !linename || !access_token || !secret_token || !channel_id) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน!" });
  }

  try {
    const shop = await Shop.findOne({ prefix });
    if (!shop) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้!" });
    }

    const isDuplicate = shop.lines.some(line => line.channel_id === channel_id);
    if (isDuplicate) {
      return res.status(409).json({ success: false, message: "บัญชี LINE นี้ถูกเพิ่มไว้แล้ว" });
    }

    shop.lines.push({
      linename,
      access_token,
      secret_token,
      channel_id    // เพิ่มตรงนี้
    });

    await shop.save();

    restartWebhooks();
    res.json({ success: true, message: "เพิ่มบัญชี LINE สำเร็จ!" });
  } catch (error) {
    console.error("❌ Error adding LINE account:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการเพิ่มบัญชี LINE" });
  }
});

// API สำหรับแก้ไขบัญชี LINE
router.post("/update-line", async (req, res) => {
  const { prefix, index, linename, access_token, secret_token, channel_id } = req.body;

  if (!prefix || index === undefined || !linename || !access_token || !secret_token || !channel_id) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  const shortChannelId = String(channel_id).slice(-4); // ใช้ 4 ตัวท้าย

  try {
    const shop = await Shop.findOne({ prefix });
    if (!shop) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
    }

    if (!shop.lines || !shop.lines[index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชี LINE ที่ต้องการแก้ไข" });
    }

    // ตรวจสอบว่า shortChannelId นี้ซ้ำกับบัญชีอื่น (ยกเว้น index เดิม)
    const isDuplicate = shop.lines.some((line, i) => {
      const lineShortId = String(line.channel_id).slice(-4);
      return i !== index && lineShortId === shortChannelId;
    });

    if (isDuplicate) {
      return res.status(409).json({ success: false, message: "บัญชี LINE นี้มีอยู่แล้ว (Channel ID ซ้ำ)" });
    }

    // อัปเดตเฉพาะรายการนี้
    shop.lines[index] = {
      linename,
      access_token,
      secret_token,
      channel_id
    };

    await shop.save();
    return res.json({ success: true, message: "อัปเดตบัญชี LINE สำเร็จ!" });
  } catch (error) {
    console.error("❌ Error updating LINE account:", error);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัปเดตบัญชี LINE" });
  }
});


// เพิ่ม API สำหรับลบบัญชี LINE
router.post("/delete-line", async (req, res) => {
  const { prefix, index } = req.body;

  if (!prefix || index === undefined) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  try {
    const shop = await Shop.findOne({ prefix });
    if (!shop) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
    }

    if (!shop.lines || shop.lines.length <= index) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชี LINE ที่ต้องการลบ" });
    }

    shop.lines.splice(index, 1);
    await shop.save();

    res.json({ success: true, message: "ลบบัญชี LINE สำเร็จ!" });
  } catch (error) {
    console.error("❌ Error deleting LINE account:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการลบบัญชี LINE" });
  }
});

router.post("/get-access-token", async (req, res) => {
  const { channelId, secretToken } = req.body;

  if (!channelId || !secretToken) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  try {
    // 1. ขอ access_token
    const tokenRes = await fetch("https://api.line.me/v2/oauth/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: channelId,
        client_secret: secretToken,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ success: false, message: "ขอ access_token ไม่สำเร็จ" });
    }

    const access_token = tokenData.access_token;

    // 2. ดึงชื่อ LINE OA จาก /v2/bot/info
    const infoRes = await fetch("https://api.line.me/v2/bot/info", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const infoData = await infoRes.json();

    const display_name = infoData.displayName || "LINE";

    // ส่งทั้ง access_token และ display_name กลับไป
    res.json({
      success: true,
      access_token,
      display_name,
    });
  } catch (error) {
    console.error("❌ Error in get-access-token:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});

router.post('/set-webhook', async (req, res) => {
  const { accessToken, webhookURL } = req.body;

  if (!accessToken || !webhookURL) {
    return res.status(400).json({ success: false, message: "ต้องระบุ accessToken และ webhookURL" });
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ endpoint: webhookURL })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ LINE API error:", result);
      return res.status(500).json({ success: false, message: "ตั้งค่า Webhook ไม่สำเร็จ", result });
    }

    return res.json({ success: true, result });

  } catch (err) {
    console.error("❌ set-webhook error:", err);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดขณะตั้งค่า Webhook", error: err.message });
  }
});

export default router;
