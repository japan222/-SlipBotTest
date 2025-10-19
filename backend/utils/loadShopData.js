// utils/loadShopData.js
import Shop from "../models/Shop.js";

export let shopData = []; // ✅ export ตัวแปรออกไปด้วย

export async function loadShopData() {
  try {
    shopData = await Shop.find().lean(); // ดึงจาก MongoDB แล้วเก็บในตัวแปร global
    console.log(`✅ โหลดร้านค้าสำเร็จ ${shopData.length} ร้าน`);
  } catch (error) {
    console.error("❌ ไม่สามารถโหลดร้านค้าจาก MongoDB:", error?.stack || error);
    shopData = [];
  }
}