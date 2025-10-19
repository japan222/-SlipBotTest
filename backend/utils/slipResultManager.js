// utils/slipResultManager.js
import axios from "axios";
import SlipResult from "../models/SlipResult.js";
import { broadcastLog } from "./logManager.js";

export async function loadSlipResults() {
  try {
    const now = Date.now();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);

    return await SlipResult.find({ createdAt: { $gte: yesterday } }).sort({ createdAt: -1 });
  } catch (err) {
    console.error("❌ โหลด slipResults ล้มเหลว:", err.message);
    broadcastLog("❌ โหลด slipResults ล้มเหลว: " + err.message);
    return [];
  }
}

export async function saveSlipResults(newSlip) {
  try {
    await SlipResult.create(newSlip);
  } catch (err) {
    console.error("❌ บันทึก slipResult ล้มเหลว:", err.message);
    broadcastLog("❌ บันทึก slipResult ล้มเหลว: " + err.message);
  }
}

export async function reportResultToAPI(baseURL, result) {
  try {
    await axios.post(`${baseURL}/api/slip-results`, result);
  } catch (error) {
    console.error("❌ ไม่สามารถส่งข้อมูลผลสลิปไปยัง API:", error.message);
    broadcastLog("❌ ไม่สามารถส่งข้อมูลผลสลิปไปยัง API: " + error.message);
  }
}

export async function removeOldSlips() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  try {
    const result = await SlipResult.deleteMany({ createdAt: { $lt: yesterday } });
    console.log(`🧹 ลบ SlipResult เก่า ${result.deletedCount} รายการ`);
  } catch (err) {
    console.error("❌ ลบข้อมูลเก่าล้มเหลว:", err.message);
    broadcastLog("❌ ลบข้อมูลเก่าล้มเหลว:", err.message);
  }
}