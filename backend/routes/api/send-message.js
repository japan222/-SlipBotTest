// routes/api/send-message.js
import * as line from "@line/bot-sdk";
import Phone from '../../models/Phone.js';
import Shop from "../../models/Shop.js";
import multer from "multer";
import UploadedImage from "../../models/lineSendingImage.js";
import express from "express";
import { broadcastLog } from "../../utils/logManager.js";
import { baseURL } from "../line-webhook.js";

const router = express.Router();

const uploadsendimage  = multer();

router.get('/uploaded-image', async (req, res) => {
  try {
    const { username, sessionId } = req.query;
    if (!username) return res.status(400).send('Missing params');

    const imageDoc = await UploadedImage.findOne({ username, sessionId });
    if (!imageDoc || !imageDoc.data) return res.status(404).send('Not found');

    res.set('Content-Type', imageDoc.contentType || 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(imageDoc.data);

  } catch (err) {
    console.error('❌ Error /uploaded-image:', err);
    res.status(500).send('Server error');
  }
});

router.delete("/delete-my-upload", async (req, res) => {
  const sessionId = req.sessionID;

  if (!sessionId) {
    return res.status(400).json({ success: false, error: "Session ไม่พบ" });
  }

  try {
    const result = await UploadedImage.deleteMany({ sessionId });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    console.error("❌ ลบรูปภาพล้มเหลว:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/user-lookup-batch', async (req, res) => {
  const { usernames } = req.body;
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return res.json({ results: [] });
  }

  try {
    const phones = await Phone.find({ user: { $in: usernames } });
    const userMap = new Map();
    phones.forEach(p => userMap.set(p.user, p.userId));

    // ค้นหา prefix ที่จำเป็นทั้งหมดครั้งเดียว
    const uniquePrefixes = [...new Set(usernames.map(u => u.substring(0, 3)))];
    const shops = await Shop.find({ prefix: { $in: uniquePrefixes } });
    const prefixMap = new Map();
    shops.forEach(shop => {
      prefixMap.set(shop.prefix, shop.lines?.[0]?.access_token || null);
    });

    const results = usernames.map(username => {
      const userId = userMap.get(username);
      const prefix = username.substring(0, 3);
      return {
        username,
        found: !!userId,
        userId,
        accessToken: prefixMap.get(prefix) || null,
      };
    });

    return res.json({ results });

  } catch (err) {
    console.error("❌ batch lookup error:", err);
    return res.status(500).json({ results: [] });
  }
});

router.post('/send-message', uploadsendimage.fields([{ name: 'image', maxCount: 1 }]), async (req, res) => {
    const { userId, message } = req.body;
    const sessionId = req.sessionID;
    const username = req.session?.user?.username;

    if (!userId)
        return res.status(400).json({ success: false, error: "Missing userId" });

    if (!username || !sessionId)
        return res.status(400).json({ success: false, error: "Missing session or username" });

    try {
        const phone = await Phone.findOne({ userId });
        if (!phone || !phone.prefix)
            return res.status(404).json({ success: false, error: "User not found in database" });

        const shop = await Shop.findOne({ prefix: phone.prefix });
        if (!shop || !shop.lines || shop.lines.length === 0)
            return res.status(404).json({ success: false, error: "No LINE OA found for shop" });

        // เตรียมรูปภาพ (ถ้ามีรูปใหม่เท่านั้น)
        let imageUrl = null;
        let uploadedImage = null;
        
        // เช็คเฉพาะกรณีมีรูปใหม่ส่งมาเท่านั้น
        if (req.files?.image?.[0]) {
            uploadedImage = await UploadedImage.create({
                username,
                sessionId,
                data: req.files.image[0].buffer,
                contentType: req.files.image[0].mimetype,
                uploadedAt: new Date()
            });
            
            const timestamp = Date.now();
            imageUrl = `${baseURL}/api/uploaded-image?username=${encodeURIComponent(username)}&sessionId=${encodeURIComponent(sessionId)}&cache_bust=${timestamp}`;
        }

        if (!imageUrl && !message) {
            return res.status(400).json({ success: false, error: "Missing message and image" });
        }

        // ส่งข้อความและรูปภาพ
        for (const lineInfo of shop.lines) {
            const client = new line.Client({ channelAccessToken: lineInfo.access_token });

            try {
                // ส่งรูปก่อน (ถ้ามี)
                let imageSent = false;

                if (imageUrl) {
                    try {
                        await client.pushMessage(userId, {
                            type: "image",
                            originalContentUrl: imageUrl,
                            previewImageUrl: imageUrl
                        });
                        
                        // รอให้ LINE ดึงรูปไปก่อน
                        await UploadedImage.deleteOne({ username, sessionId });
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        imageSent = true;
                    } catch (error) {
                        console.error('❌ ไม่สามารถส่งรูปภาพ:', error);
                    }
                }
                
                // ส่งข้อความ (ถ้ามี)
                if (message) {
                    await client.pushMessage(userId, { 
                        type: "text", 
                        text: message 
                    });
                }

                // หลังส่งเสร็จทั้งหมด ถ้าส่งรูปสำเร็จให้ลบรูปจากฐานข้อมูล
                if (imageSent) {
                    try {
                        await UploadedImage.deleteMany({ sessionId });
                    } catch (error) {
                        console.error('❌ เกิดข้อผิดพลาดในการลบรูปภาพจากฐานข้อมูล:', error);
                    }
                }

                broadcastLog(
                    `📨 ส่ง ${imageSent ? 'ภาพ' : ''}${imageSent && message ? ' + ' : ''}${message ? 'ข้อความ' : ''} จาก ${username} ไปยัง ${userId} ผ่านร้าน ${lineInfo.linename}`
                );

                return res.json({
                    success: true,
                    usedLine: lineInfo.linename,
                    shopName: shop.name,
                    type: imageSent && message ? "image+text" : (imageSent ? "image" : "text")
                });

            } catch (err) {
                console.error(`❌ ไม่สามารถส่งผ่าน ${lineInfo.linename}:`, err);
                console.error('Error details:', err.response?.data || err.message);
                
                // ส่ง log ให้ admin ทราบ
                broadcastLog(
                    `❌ ส่งไม่สำเร็จ: ${userId} (${err.message}) - ลองส่งผ่าน ${lineInfo.linename} ไม่ได้`
                );
            }
        }

        return res.status(500).json({
            success: false,
            error: "ไม่สามารถส่งข้อความหรือภาพผ่าน LINE OA ใด ๆ ได้"
        });

    } catch (err) {
        console.error("❌ send-message error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
    }
});

router.post("/upload-send-image-line", uploadsendimage.single("image"), async (req, res) => {
  try {
    // ปฏิเสธทันทีหากไม่มีไฟล์
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "ไม่พบไฟล์ภาพที่ส่งมา หรือไฟล์ไม่ถูกต้อง" });
    }

    // อนุญาตเฉพาะ mimetype ที่ LINE รองรับ
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "รองรับเฉพาะไฟล์ภาพเท่านั้น" });
    }

    const username = req.session?.user?.username || "unknown";
    const sessionId = req.sessionID || "unknown";

    if (!sessionId || !username) {
      return res.status(400).json({ error: "ไม่มี session" });
    }

    const result = await UploadedImage.findOneAndUpdate(
    { username, sessionId },
    {
        $set: {
            data: req.file.buffer,
            contentType: req.file.mimetype,
            uploadedAt: new Date(),
        }
    },
    {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
    }
    );

    res.json({
      success: true,
      message: "✅ อัปโหลดรูปภาพสำเร็จ",
      fileId: result._id.toString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "เกิดข้อผิดพลาดระหว่างอัปโหลด" });
  }
});

export default router;