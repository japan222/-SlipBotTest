// utils/qrSlipworker.js
import jsQR from "jsqr";
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createWorker } from "tesseract.js";

// keywords ที่พบบ่อยในภาพสลิปธนาคาร
const keywords = [
    // กลุ่ม 1: คำเกี่ยวกับสถานะการโอน
    "โอนเงินสำเร็จ", "ทำรายการสำเร็จ", "รายการสำเร็จ", "ดำเนินการเสร็จสิ้น", 
    "successful", "transaction completed", "transaction success", "transaction successful", "transfer complete", "completed",
  
    // กลุ่ม 2: ข้อมูลการทำรายการ
    "reference", "ref", "transref", "transaction id", "รหัสอ้างอิง", "เลขอ้างอิง", "เลขที่รายการ", "รหัสที่รายการ", "รหัสธุรกรรม",
    "จำนวนเงิน", "ยอดเงิน", "ยอดโอน", "ค่าธรรมเนียม", "จำนวน", "รายการโอนเงินสำเร็จ", "สำเนาสลิป", "slip", "transaction",
  
    // กลุ่ม 3: ผู้โอน / ผู้รับ / บัญชี
    "จาก", "ไปยัง", "ถึง", "ผู้โอน", "ผู้รับ", "เลขบัญชี", "บัญชีธนาคาร", "ชื่อผู้รับ", "ผู้รับเงิน",
    "from", "to", "beneficiary", "sender", "receiver", "account name", "account holder", "account number",
    "a/c number", "bank account", "recipient", "withdrawer", "amount", "total amount",
    "transaction amount", "transfer amount", "payment amount", "total payment", "fee",
  
    // กลุ่ม 5: ชื่อธนาคาร
    "ไทยพาณิชย์", "kbank", "krungthai", "กรุงไทย", "กรุงเทพ", "bangkok bank",
    "ธนชาต", "ออมสิน", "กรุงศรี", "ธนาคารกรุงเทพ", "ธนาคารกสิกรไทย",
    "ธนาคารกรุงไทย", "ธนาคารทหารไทยธนชาต", "ธนาคารไทยพาณิชย์", "ธนาคารออมสิน", "ธนาคารยูโอบี", "ธนาคารซิตี้แบงก์", "ธนาคารซีไอเอ็มบีไทย",
    "ธนาคารกรุงศรีอยุธยา", "ธนาคารธนชาต", "ธนาคารเกียรตินาคินภัทร", "ธนาคารซีไอเอ็มบีไทย", "ธนาคารทิสโก้", "ธนาคารแลนด์แอนด์เฮ้าส์", "ธนาคารไทยเครดิตเพื่อรายย่อย",
    "ธนาคารไอซีบีซี (ไทย)", "ธนาคารอาคารสงเคราะห์", "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร", "ธนาคารเพื่อการพัฒนาเอเชีย", "ธนาคารเพื่อการส่งออกและนำเข้าแห่งประเทศไทย",
    "ธนาคารพัฒนาวิสาหกิจขนาดกลางแห่งประเทศไทย",
    "KBANK", "KTB", "TTB", "SCB", "BAY", "KKP", "CIMBT", "TISCO", "UOBT", "TCD", "LHFG", "ICBCT", "SME", "GSB", "EXIM", "GHB", "BAAC",

    // กลุ่ม 6: คำที่มักอยู่บนสลิป / ระบบ Mobile Banking
    "qrcode", "verified", "แสกนqr", "คิวอาร์โค้ด", "สแกนตรวจสอบสลิป", "mobile banking", "online banking", "ibanking",
    "my mo", "krungthai next", "k plus", "scb easy", "tmb touch", "krungsri",
  ];

// คำที่บ่งบอกว่าเป็นภาพกรณีพิเศษ
const specialKeywords = [
   "เลือกธนาคาร", "ชื่อบัญชี", "ประวัติธุรกรรม", "ฝาก", "ถอน" , "บันทึกใบเสร็จ", "ดูบัญชีของคุณ", "ส่งคำขอโอนเงิน", "เลขที่บัญชี", "ยอดเงินทั้งหมด", 
   "เลือกธนาคาร", "username", "ประวัติธุรกรรม", "deposit", "withdraw" , "truemoney", "auto.", "ส่งคำขอโอนเงิน", "เลขที่บัญชี", "ยอดเงินทั้งหมด", 
];

const rewardKeywords = [
  "รายการแลก", "เล่นกิจกรรม", "หมุนวง", "หมุนเลย",
  "รับของ", "เปิดหีบสมบัติ", "คะแนนสะสม", "หมน", "หมูน",
  "100credits", "1freespin", "20point", "100point", "40point",
  "กล่องปริศนา", "เล่นเลย", "หมูนวงล้อ",
  "ประวัติการเล่น", "รางวัล", "เครดิต", "ดำเนินการ", "กำลัง",
  "ได้รับ", "1", "หรรษา"
];

const lossAmountKeywords = [
  "ประวัติ", "แพ้", "ชนะ", "สีเขียว",
  "คือ", "แพ็คเกจ", "ฝากเงิน", "ถอนเงิน", "ถอบเงิน",
  "ทรัพย์", "ผู้เล่น", "วันที่", "ขอดได้", "ซนะ",
  "เพ้", "จ่าย", "สูงสุด", "5000", "ยอด", "สี", "เข้าเล่น",
  "ที่มี", "สิทธิ์", "คืนยอด", "ยอดได้", "คืนขอด",
];


// OCR: อ่านข้อความจากภาพ
async function extractTextFromImage(buffer) {
  let worker;

  try {
    worker = await createWorker("tha+eng");
    const { data: { text } } = await worker.recognize(buffer);
    return text.toLowerCase();
  } catch (err) {
    console.error("❌ OCR ผิดพลาด:", err);
    return ""; // คืนค่าว่างในกรณีผิดพลาด
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

async function detectSpecialImage(text) {
const matched = specialKeywords.filter(k => text.includes(k.toLowerCase()));
return matched.length >= 2;
}

async function detectRewardImage(text) {
  const matched = rewardKeywords.filter(k => text.includes(k.toLowerCase()));
  return matched.length >= 2;
}

async function detectLossAmountImage(text) {
  const matched = lossAmountKeywords.filter(k => text.includes(k.toLowerCase()));
  return matched.length >= 2;
}
  
// แปลง stream เป็น Buffer (สำรองไว้ใช้กรณีพี่ใช้ stream ภายนอก)
const streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
};

// ตรวจสอบว่าเป็น QR Code สำหรับการชำระเงินหรือไม่
function isPaymentQR(qrData) {
  const hasPaymentTag = qrData.includes("A0000006770101"); // ใช้ใน PromptPay
  const hasCurrencyTag = qrData.includes("5303764"); // 764 = Thai Baht
  return hasPaymentTag || hasCurrencyTag;
}

// ตรวจสอบว่าเป็น QR Code ของสลิปธนาคารหรือไม่
function isBankSlipQR(qrData) {
  if (isPaymentQR(qrData)) return false;
  const hasTH91 = qrData.includes("TH91");
  const hasNoURL = !qrData.includes("http://") && !qrData.includes("https://");
  const isValidLength = qrData.length >= 30 && qrData.length <= 80;
  const qrPattern = /^[0-9A-Za-z]{10,}TH91[0-9A-Za-z]{5,}$/;
  return hasTH91 && hasNoURL && isValidLength && qrPattern.test(qrData);
}

// ฟังก์ชันสแกน QR Code จากภาพ
const scan_qr_code = async (buffer) => {
  try {
    const image = await loadImage(buffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, image.width, image.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
    const qrData = qrCode ? qrCode.data : null;

    return qrData && isBankSlipQR(qrData) ? qrData : null;
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการสแกน QR Code:", error.message);
    return null;
  }
};

// วิเคราะห์ภาพตามลำดับเงื่อนไข
async function analyzeSlipImage(buffer) {
  const qrData = await scan_qr_code(buffer);
  if (qrData && isBankSlipQR(qrData)) {
    return qrData; // เป็นสลิปจริง มี QR
  }

  // ถ้าไม่มี QR → OCR ตรวจสอบพิเศษก่อน
  const text = await extractTextFromImage(buffer);

  if (await detectLossAmountImage(text)) {
    return { LossAmount: true }; // เป็นภาพเกี่ยวกับการแลกของรางวัล
  }

  // ตรวจเจอ reward ก่อน
  if (await detectRewardImage(text)) {
    return { reward: true }; // เป็นภาพเกี่ยวกับการแลกของรางวัล
  }

  if (await detectSpecialImage(text)) {
    return null; // เป็นภาพคล้ายสลิป แต่ไม่ใช่สลิป
  }

  const matchedKeywords = keywords.filter((k) => text.includes(k.toLowerCase()));
  if (matchedKeywords.length >= 3) {
    return { suspicious: true }; // สลิปต้องสงสัย
  }

  return null; // ไม่ตรงเงื่อนไขใดเลย
}


export { analyzeSlipImage, streamToBuffer };