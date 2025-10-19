// routes/api/status.js
import Shop from "../../models/Shop.js";
import express from "express";

const router = express.Router();

router.post("/update-bonusTime-status", async (req, res) => {
  const { prefix, statusBonusTime } = req.body;

  try {
    const shop = await Shop.findOneAndUpdate(
      { prefix },
      { statusBonusTime },
      { new: true }
    );

    if (!shop) return res.json({ success: false, message: "ไม่พบร้านค้า" });

    res.json({ success: true, message: "อัปเดตสถานะ BonusTime เรียบร้อย" });
  } catch (err) {
    console.error("❌ Error updating BonusTime status:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});


router.post("/update-password-status", async (req, res) => {
  const { prefix, statusPassword } = req.body;

  try {
    const shop = await Shop.findOneAndUpdate(
      { prefix },
      { statusPassword },
      { new: true }
    );

    if (!shop) return res.json({ success: false, message: "ไม่พบร้านค้า" });

    res.json({ success: true, message: "อัปเดตสถานะ Password เรียบร้อย" });
  } catch (err) {
    console.error("❌ Error updating Password status:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});


router.post('/update-textbot-status', async (req, res) => {
  const { prefix, statusBot } = req.body;

  try {
    const shop = await Shop.findOneAndUpdate(
      { prefix },
      { statusBot },
      { new: true }
    );

    if (!shop) {
      return res.json({ success: false, message: "ไม่พบร้านค้า" });
    }

    res.json({ success: true, message: "อัปเดตสถานะบอทข้อความเรียบร้อย" });
  } catch (err) {
    console.error("❌ Error updating text bot status:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});

router.post('/update-withdraw-status', async (req, res) => {
  const { prefix, statusWithdraw } = req.body;

  try {
    const shop = await Shop.findOneAndUpdate(
      { prefix },
      { statusWithdraw },
      { new: true }
    );

    if (!shop) {
      return res.json({ success: false, message: "ไม่พบร้านค้า" });
    }

    res.json({ success: true, message: "อัปเดตสถานะ ปิด/เปิด การถอน เรียบร้อย" });
  } catch (err) {
    console.error("❌ Error updating withdraw status:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});

router.post("/update-slip-option", async (req, res) => {
  const { prefix, slipCheckOption } = req.body;

  if (!prefix || !slipCheckOption) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }
  try {
    const shop = await Shop.findOne({ prefix });
    if (!shop) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
    }

    shop.status = false;
    shop.slipCheckOption = slipCheckOption;
    await shop.save();

    res.json({ success: true, message: "บันทึกการเปลี่ยนแปลงสำเร็จ" });
  } catch (error) {
    console.error("❌ Error updating slip check option:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัปเดตตัวเลือกตรวจสลิป" });
  }
});

export default router;