//reply.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { broadcastLog } from "../../../utils/logManager.js";
import Shop from "../../../models/Shop.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getBonustimeReply(prefix, baseURL) {
  try {
    const shop = await Shop.findOne({ prefix }, "statusBonusTime bonusImage");

    if (!shop || !shop.statusBonusTime || !shop.bonusImage) {
      return null;
    }

    const imageUrl = `${baseURL}/api/get-bonus-image-original?prefix=${prefix}&cache_bust=${Date.now()}`;

    return {
      type: "image",
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    };
  } catch (err) {
    console.error("❌ Error in getBonustimeReply:", err);
    return null;
  }
}

async function getPasswordReply(prefix, baseURL) {
  try {
    const shop = await Shop.findOne({ prefix }, "statusPassword passwordImage");

    if (!shop || !shop.statusPassword || !shop.passwordImage) {
      return null;
    }

    const imageUrl = `${baseURL}/api/get-password-image-original?prefix=${prefix}&cache_bust=${Date.now()}`;

    return {
      type: "image",
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    };
  } catch (err) {
    console.error("❌ Error in getPasswordReply:", err);
    return null;
  }
}

async function checkSuspiciousLink(text) {
  // ตรวจจับคร่าว ๆ ว่ามี https:// หรือ www. ปรากฏอยู่หรือไม่ (ไม่ normalize, ไม่ล้าง char แปลก)
  const hasSuspiciousPattern =
    text.includes('https://') ||
    text.includes('http://') ||
    text.includes('www.');

  if (!hasSuspiciousPattern) return false;

  // ดึงลิงก์ทั้งหมดออกมา (ทั้งแบบ https:// และ www.)
  const matches = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi);
  if (!matches) return false;

  // รูปแบบที่อนุญาตให้ผ่าน (whitelist domains เช่น auto.xxx.com)
  const whitelistPattern = /^auto\.[a-z0-9.-]+$/i;

  for (const rawUrl of matches) {
    try {
      // ถ้าไม่ใช่ http ให้เติม http:// ข้างหน้าเพื่อ parse ได้
      const fullUrl = rawUrl.startsWith('http') ? rawUrl : 'http://' + rawUrl;
      const parsed = new URL(fullUrl);
      const host = parsed.hostname;

      // ถ้าไม่ตรง whitelist → ถือว่า link ต้องสงสัย
      if (!whitelistPattern.test(host)) {
        return true;
      }
    } catch (err) {
      // กรณี parse ไม่ได้ → ถือว่า link ต้องสงสัย
      return true;
    }
  }

  // ถ้าทั้งหมดผ่าน whitelist → ไม่ต้องสงสัย
  return false;
}

async function getRandomReplyFromFile(fileAndKey, prefix = null) {
  try {
    let filename = fileAndKey;
    let key = null;

    // แยกไฟล์:key
    if (fileAndKey.includes(':')) {
      [filename, key] = fileAndKey.split(':');
    }

    // เติม .json ถ้าไม่มี
    if (!filename.endsWith('.json')) {
      filename += '.json';
    }

    const filePath = path.join(__dirname, '../reply', filename);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ ไม่พบไฟล์: ${filePath}`);
      return null;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    let replies;
    if (Array.isArray(data)) {
      // กรณีไฟล์ยังเป็น array แบบเก่า
      replies = data;
    } else if (typeof data === 'object' && key && Array.isArray(data[key])) {
      // กรณีไฟล์เป็น object แล้วเลือกตาม key
      replies = data[key];
    } else {
      console.warn(`⚠️ ไม่พบ key "${key}" ในไฟล์ ${filename}`);
      return null;
    }

    if (replies.length === 0) {
      console.warn(`⚠️ ไฟล์ ${filename} (key=${key}) ไม่มีข้อความ`);
      return null;
    }

    const randomIndex = Math.floor(Math.random() * replies.length);
    let reply = replies[randomIndex];

    // เฉพาะกรณี register:how + มี prefix → แทนค่าตัวแปร
    if (prefix && fileAndKey.startsWith('register:how')) {
      const shop = await Shop.findOne({ prefix });
      if (shop) {
        reply = reply
          .replace('${nameshop}', shop.name)
          .replace('${link}', shop.registerlink);
      }
    }

    if (prefix && fileAndKey.startsWith('link')) {
      const shop = await Shop.findOne({ prefix });
      if (shop) {
        reply = reply
          .replace('${link}', shop.loginlink);
      }
    }

    return reply;

  } catch (err) {
    console.error(`❌ Error reading ${fileAndKey}:`, err);
    broadcastLog(`❌ Error reading ${fileAndKey}: ${err.message}`);
    return null;
  }
}

/**
 * ตอบกลับตามหมวดหมู่ โดยใช้ชื่อหมวดเป็นชื่อไฟล์ reply เช่น greeting → reply/greeting.json
 * @param {string} text - ข้อความจาก GPT เช่น "ทักทาย: สวัสดีค่ะ"
 * @returns {{ category: string, text: string } | null}
 */
function getReplyMessage(text) {
  const category = detectCategory(text);

  console.log(`📂 ตรวจพบ category: "${category}" สำหรับข้อความ: "${text}"`);
  broadcastLog(`📂 ตรวจพบ category: "${category}" สำหรับข้อความ: "${text}"`);

  const reply = getRandomReplyFromFile(`${category}.json`);
  if (!reply) return null;

  return { category, text: reply };
}

async function sendMessageWait1() {
    const messages = [
        "น้องแอดมินกำลังตรวจสอบให้นะค้าา ขอเวลา 1-2 นาทีนะคะ 💐🙏",
        "ขอเวลาหนูตรวจสอบสักครู่นะคะ แป๊บเดียวเท่านั้น เดี๋ยวน้องแอดมินรีบแจ้งให้ทราบนะคะ 🙇‍♂️🌷🤗",
        "ขอเวลาแอดตรวจสอบสักครู่นะคะ ขอเวลา 1-2 นาทีนะคะ ขออภัยที่ล่าช้านะค้าา 🙏🌷",
        "หนูกำลังตรวจสอบให้อยู่ค่ะ ขออภัยที่ล่าช้านะค้าา ขอเวลา 1-2 นาทีนะคะ 🙏💖",
        "แอดทำการตรวจสอบให้นะคะ ขอเวลาสักครู่น้าา เสร็จแล้วแอดแจ้งนะคะ 🙇‍♂️✨",
        "รบกวนลูกค้ารอสักครู่ รายการกำลังถูกตรวจสอบนะคะ เดี๋ยวแอดมินแจ้งให้ทราบอีกครั้งนะค้า 🙇‍♂️💞",
        "แอดมินกำลังตรวจสอบและดำเนินการให้สักครู่นะคะ ขอเวลาแป๊บเดียวเท่านั้นค่ะ 🙏🌟",
        "หนูกำลังตรวจสอบให้นะค้าา ขอเวลาแป๊บนึงนะคะคุณลูกค้า 🌼💜"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

async function sendMessageWait2() {
    const messages = [
        "น้องแอดมินกำลังเร่งตรวจสอบให้นะค้าา ขออภัยที่ล่าช้านะ ขอเวลา 1-2 นาทีค่า 💐🤍🙏",
        "ขอเวลาแอดมินตรวจสอบสักครู่นะคะ แป๊บเดียวเท่านั้น เดี๋ยวน้องแอดมินรีบแจ้งให้ทราบนะคะ 🙇‍♂️🤗",
        "ขอเวลาแอดตรวจสอบสักครู่นะคะ ขออภัยที่ล่าช้านะค้าา ขอเวลา 1-2 นาทีนะคะ 💜🙏",
        "หนูกำลังรีบตรวจสอบให้อยู่ค่ะ ขออภัยที่ล่าช้านะค้าา ขอเวลา 1-2 นาทีนะคะ 🙏💖",
        "แอดมินกำลังรีบดำเนินการให้อยู่ค่า ขอเวลาสักครู่น้าา เดี๋ยวแจ้งผลให้เลยค่า 🙇‍♂️✨",
        "รายการกำลังถูกตรวจสอบนะคะ เดี๋ยวแอดมินแจ้งให้ทราบอีกครั้งนะค้า 🌷🙇‍♂️💞",
        "แอดมินกำลังเร่งตรวจสอบและดำเนินการให้นะคะ ขอเวลาแป๊บเดียวเท่านั้นค่ะ 🙏🌟",
        "หนูกำลังรีบตรวจสอบให้นะค้าา ขอเวลาอีกสักครู่ เดี๋ยวแอดรีบแจ้งไปน้าา ✨💜"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}


export { getReplyMessage, getRandomReplyFromFile, getBonustimeReply, getPasswordReply, checkSuspiciousLink, sendMessageWait1, sendMessageWait2 };
