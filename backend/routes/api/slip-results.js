// routes/api/slips.js
import moment from "moment-timezone";
import SlipResult from "../../models/SlipResult.js";
import express from "express";

const router = express.Router();
const slipClients = [];

router.get("/slip-events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  slipClients.push(res);

  req.on("close", () => {
    const index = slipClients.indexOf(res);
    if (index !== -1) slipClients.splice(index, 1);
  });
});

// GET: ดึง slip ล่าสุด 100 รายการ (ภายใน 24 ชม.)
router.get("/slip-results", async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const results = await SlipResult.find({
      createdAt: { $gte: oneDayAgo }
    }).sort({ createdAt: -1 }).limit(100);

    res.json(results);
  } catch (err) {
    console.error("❌ โหลด slip results ล้มเหลว:", err.message);
    res.status(500).json({ message: "โหลดข้อมูลไม่สำเร็จ" });
  }
});

// POST: รับ slip ใหม่ + บันทึก MongoDB + broadcast
router.post("/slip-results", async (req, res) => {
  try {
    const now = moment().tz('Asia/Bangkok').toDate();

    const newSlip = {
      shop: req.body.shop,
      lineName: req.body.lineName,
      phoneNumber: req.body.phoneNumber,
      userId: req.body.userId,
      text: req.body.text,
      status: req.body.status,
      response: req.body.response,
      prefix: req.body.prefix,
      amount: req.body.amount,
      ref: req.body.ref,
      reply: req.body.reply,
      time: req.body.time,
      createdAt: now,
    };
    
    await SlipResult.create(newSlip);

    const data = `data: ${JSON.stringify(newSlip)}\n\n`;
    slipClients.forEach(client => client.write(data));

    res.status(201).json({ message: "บันทึกแล้ว" });
  } catch (err) {
    console.error("❌ บันทึก SlipResult ล้มเหลว:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

export default router;