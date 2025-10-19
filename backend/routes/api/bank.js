// routes/api/bank.js
import { setupWebhooks } from "../../routes/line-webhook.js";
import { loadBankAccounts } from "../../index.js";
import BankAccount from "../../models/BankAccount.js";
import express from "express";

const router = express.Router();

router.get("/bank-accounts", (req, res) => {
  try {
    res.json({ accounts: bankAccounts });
  } catch (err) {
    console.error("❌ โหลดบัญชีล้มเหลว:", err.message);
    res.status(500).json({ error: "โหลดบัญชีไม่สำเร็จ" });
  }
});

router.post("/add-bank", async (req, res) => {
  const { prefix, name, number } = req.body;

  if (!prefix || !name || !number) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบ" });
  }

  try {
    await BankAccount.create({
      prefix,
      name,
      account: number,
      status: false
    });

    await loadBankAccounts(); // Reload global variable
    res.json({ success: true });
  } catch (err) {
    console.error("❌ ไม่สามารถเพิ่มบัญชี:", err.message);
    res.status(500).json({ success: false, message: "ไม่สามารถบันทึกข้อมูล" });
  }
});

router.post("/edit-bank", async (req, res) => {
  const { prefix, index, name, number } = req.body;

  if (
    typeof prefix !== "string" ||
    typeof index !== "number" ||
    typeof name !== "string" ||
    typeof number !== "string"
  ) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบหรือไม่ถูกต้อง" });
  }

  try {
    const accounts = await BankAccount.find({ prefix });
    if (!accounts[index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชีธนาคารที่ต้องการแก้ไข" });
    }

    accounts[index].name = name;
    accounts[index].account = number;
    await accounts[index].save();
    restartWebhooks(); // รีโหลด Webhook ใหม่
    res.json({ success: true });
  } catch (err) {
    console.error("❌ แก้ไขบัญชีล้มเหลว:", err.message);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการบันทึก" });
  }
});

router.post("/update-bank-status", async (req, res) => {
  const { prefix, index, status } = req.body;

  try {
    const accounts = await BankAccount.find({ prefix });
    if (!accounts[index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชีธนาคาร" });
    }

    accounts[index].status = status;
    await accounts[index].save(); // สำคัญมาก ต้อง save หลังเปลี่ยนค่า

    await loadBankAccounts();     // รีโหลด global variable ให้บอทเห็นค่าที่เปลี่ยน
    await setupWebhooks();        // รีโหลด webhook
    res.json({ success: true });
  } catch (err) {
    console.error("❌ ไม่สามารถอัปเดตสถานะบัญชีได้:", err.message);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});

router.post("/delete-bank", async (req, res) => {
  const { prefix, index } = req.body;

  if (typeof prefix !== "string" || typeof index !== "number") {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง" });
  }

  try {
    const accounts = await BankAccount.find({ prefix });
    if (!accounts[index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชีธนาคารในตำแหน่งนี้" });
    }

    const accountToDelete = accounts[index];
    await BankAccount.deleteOne({ _id: accountToDelete._id });

    res.json({ success: true, message: "ลบบัญชีสำเร็จ" });
  } catch (err) {
    console.error("❌ ลบบัญชีล้มเหลว:", err.message);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการลบบัญชี" });
  }
});

export default router;