// routes/api/line-images.js
import sharp from "sharp";
import Shop from "../../models/Shop.js";
import multer from "multer";
import express from "express";

const router = express.Router();

const upload = multer();

router.post("/upload-bonus-image", upload.single("image"), async (req, res) => {
  try {
    const { prefix } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "ไม่พบไฟล์ภาพที่อัปโหลด" });
    }

    // 🖼️ รับ buffer ที่อัปโหลดมา
    let imageBuffer = req.file.buffer;

    // แปลงเป็น JPEG เสมอ
    imageBuffer = await sharp(imageBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // กัน transparency เป็นพื้นหลังขาว
      .jpeg() // ไม่มีการกำหนด quality → ใช้ default เต็ม ๆ
      .toBuffer();

    await Shop.findOneAndUpdate(
      { prefix },
      {
        bonusImage: {
          data: imageBuffer,
          contentType: "image/jpeg",
        },
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, message: "บันทึกภาพ BonusTime เรียบร้อย" });
  } catch (err) {
    console.error("❌ Upload Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get('/get-bonus-image-original', async (req, res) => {
  const { prefix } = req.query;

  const shop = await Shop.findOne({ prefix });
  if (!shop || !shop.bonusImage) return res.sendStatus(404);

  const imageBuffer = shop.bonusImage.data;
  const contentType = shop.bonusImage.contentType || 'image/png';

  res.set('Content-Type', contentType);
  res.set('Cache-Control', 'no-store'); // 🔒 ป้องกัน cache
  res.send(imageBuffer); // ต้องส่ง raw buffer ตรง ๆ
});

// เสิร์ฟรูป BonusTime จริง
router.get("/get-bonus-image", async (req, res) => {
  const { prefix } = req.query;
  const shop = await Shop.findOne({ prefix });

  if (!shop || !shop.bonusImage?.data) {
    return res.status(404).json({ success: false, message: "ยังไม่ได้อัปโหลดรูป BonusTime" });
  }

  try {
    const optimized = await sharp(shop.bonusImage.data)
      .resize(600) // จำกัดความกว้าง
      .jpeg({ quality: 70 }) // ลดคุณภาพลง
      .toBuffer();

    res.set("Content-Type", "image/jpeg");
    res.send(optimized);
  } catch (err) {
    console.error("❌ Sharp Error:", err);
    res.status(500).send("Server error");
  }
});

router.post("/delete-bonus-image", async (req, res) => {
  try {
    const { prefix } = req.body;
    const shop = await Shop.findOne({ prefix });
    if (!shop) return res.status(404).json({ success: false, message: "ไม่พบร้านค้า" });

    shop.bonusImage = undefined; // ลบค่าออก
    await shop.save();

    res.json({ success: true, message: "ลบรูป BonusTime สำเร็จ" });
  } catch (err) {
    console.error("❌ Error deleting bonus image:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get('/get-password-image-original', async (req, res) => {
  const { prefix } = req.query;

  const shop = await Shop.findOne({ prefix });
  if (!shop || !shop.passwordImage) return res.sendStatus(404);

  const imageBuffer = shop.passwordImage.data;
  const contentType = shop.passwordImage.contentType || 'image/png';

  res.set('Content-Type', contentType);
  res.set('Cache-Control', 'no-store'); // 🔒 ป้องกัน cache
  res.send(imageBuffer); // ต้องส่ง raw buffer ตรง ๆ
});

router.post("/upload-password-image", upload.single("image"), async (req, res) => {
  try {
    const { prefix } = req.body;

    let imageBuffer = req.file.buffer;

    // แปลงเป็น JPEG เสมอ
    imageBuffer = await sharp(imageBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg()
      .toBuffer();

    await Shop.findOneAndUpdate(
      { prefix },
      {
        passwordImage: {
          data: imageBuffer,
          contentType: "image/jpeg",
        },
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, message: "บันทึกภาพ ลืม Password เรียบร้อย" });
  } catch (error) {
    console.error("❌ upload error:", error);
    res.status(500).json({ error: "ไม่สามารถอัปโหลดรูปได้" });
  }
});

// เสิร์ฟรูป password จริง
router.get("/get-password-image", async (req, res) => {
  const { prefix } = req.query;
  const shop = await Shop.findOne({ prefix });

  if (!shop || !shop.passwordImage?.data) {
    return res.status(404).json({ success: false, message: "ยังไม่ได้อัปโหลดรูป ลืม Password" });
  }

  try {
    const optimized = await sharp(shop.passwordImage.data)
      .resize(600) // จำกัดความกว้าง
      .jpeg({ quality: 70 }) // ลดคุณภาพลง
      .toBuffer();

    res.set("Content-Type", "image/jpeg");
    res.send(optimized);
  } catch (err) {
    console.error("❌ Sharp Error:", err);
    res.status(500).send("Server error");
  }
});

router.post("/delete-password-image", async (req, res) => {
  try {
    const { prefix } = req.body;
    const shop = await Shop.findOne({ prefix });
    if (!shop) return res.status(404).json({ success: false, message: "ไม่พบร้านค้า" });

    shop.passwordImage = undefined; // ลบค่าออก
    await shop.save();

    res.json({ success: true, message: "ลบรูป Password สำเร็จ" });
  } catch (err) {
    console.error("❌ Error deleting password image:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;