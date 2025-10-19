//reply.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { broadcastLog } from "../../../utils/logManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// โหลด shop config ไว้ใช้แทนค่า
const shopConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../textUtils/shops.json'), 'utf8')
);

function getRandomReplyFromFile(fileAndKey, prefix = null) {
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
      const shop = shopConfig[prefix];
      if (shop) {
        reply = reply
          .replace('${nameshop}', shop.nameshop)
          .replace('${link}', shop.registerlink);
      }
    }

    if (prefix && fileAndKey.startsWith('link')) {
      const shop = shopConfig[prefix];
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

  const reply = getRandomReplyFromFile(`${category}.json`);
  if (!reply) return null;

  return { category, text: reply };
}

export { getReplyMessage, getRandomReplyFromFile, };
