// routes/api/phone.js
import { checkAndSavePhoneNumber, checkAndUpdatePhoneNumber } from "../../utils/savePhoneNumber.js";
import express from "express";
import { clients } from "../../utils/logManager.js";

const router = express.Router();

router.post('/save-phone', async (req, res) => {
  const { phoneNumber, userId, prefix } = req.body;

  if (!phoneNumber || !userId || !prefix) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
  }

  try {
    await checkAndSavePhoneNumber(phoneNumber, userId, prefix);
    await checkAndUpdatePhoneNumber(phoneNumber, userId, prefix);
    res.json({ message: 'บันทึกเบอร์โทรสำเร็จ' });
  } catch (err) {
    console.error('❌ บันทึกเบอร์โทรจาก Admin ล้มเหลว:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});



export function broadcastPhoneUpdate(userId, phoneNumber, lineName) {
  const phoneData = { userId, phoneNumber, lineName };
  const data = `event: phoneUpdate\ndata: ${JSON.stringify(phoneData)}\n\n`;

  let successCount = 0;

  clients.forEach((client, index) => {
    try {
      client.write(data);
      successCount++;
    } catch (error) {
      console.error(`❌ ส่งไม่สำเร็จกับ client[${index}]:`, error);
    }
  });
}

export default router;
