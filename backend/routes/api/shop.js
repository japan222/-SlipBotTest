// routes/api/shop.js
import PrefixForshop from "../../models/Prefix.js";
import Shop from "../../models/Shop.js";
import express from "express";

const router = express.Router();

// API อัปเดตชื่อร้าน และสถานะร้านค้า
router.post("/update-shop", async (req, res) => {
  const { prefix, name, status } = req.body;

  if (!prefix) {
    return res.status(400).json({ success: false, message: "กรุณาระบุ prefix ของร้านค้า" });
  }

  try {
    const shop = await Shop.findOne({ prefix });

    if (!shop) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
    }

    if (name) shop.name = name;
    if (typeof status === "boolean") shop.status = status;

    await shop.save();
    restartWebhooks();

    res.json({ success: true, message: "อัปเดตร้านค้าเรียบร้อย" });
  } catch (error) {
    console.error("❌ Error updating shop:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัปเดตร้านค้า" });
  }
});

// Endpoint สำหรับส่งข้อมูลร้านค้า
router.get("/shops", async (req, res) => {
  try {
    const shops = await Shop.find({}, { bonusImage: 0, passwordImage: 0 });
    res.json({ shops });
  } catch (error) {
    console.error("❌ ไม่สามารถโหลดข้อมูลร้านค้าจาก MongoDB:", error.message);
    res.status(500).json({ error: "ไม่สามารถโหลดข้อมูลร้านค้าได้" });
  }
});

router.post("/add-shop", async (req, res) => {
    const { name, prefix } = req.body;
  
    if (!name || !prefix) {
      return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลให้ครบ" });
    }  

    try {
      // ตรวจสอบว่ามี prefix ซ้ำหรือไม่
      const existingShop = await Shop.findOne({ prefix });
      if (existingShop) {
        return res.status(400).json({ success: false, message: "Prefix นี้ถูกใช้ไปแล้ว" });
      }
  
      const existingStat = await PrefixForshop.findOne({ Prefix: prefix });

      if (!existingStat) {
        return res.status(400).json({
          success: false,
          message: `ไม่สามารถเพิ่มร้านได้: prefix '${prefix}' ไม่อยู่ในระบบ`
        });
      }
  
      // บันทึกร้านค้าใหม่ลง MongoDB
      const newShop = new Shop({
        name,
        prefix,
        lines: [],
        status: false,
        slipCheckOption: "duplicate",
        statusBot: false,
        statusWithdraw: false,
        statusBonusTime: false,
        statusPassword: false,
      });
      await newShop.save();
  
      restartWebhooks(); // รีโหลด Webhook ใหม่
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding shop:", error);
      res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการเพิ่มร้านค้า" });
    }
});

// Endpoint สำหรับลบร้านค้า
router.post("/delete-shop", async (req, res) => {
  const { prefix } = req.body;

  try {
    const result = await Shop.deleteOne({ prefix });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้าด้วย prefix นี้" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error deleting shop:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการลบร้านค้า" });
  }
});

export default router;