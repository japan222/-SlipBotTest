// models/Phone.js
import mongoose from 'mongoose';

const phoneSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  prefix: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }, // ✅ เก็บเวลาเพื่อ audit log / TTL ได้ในอนาคต
  user: { type: String, required: true }
});

// ✅ ถ้าเคยเรียก model นี้มาแล้วใน hot-reload dev mode ให้ใช้ของเดิม
const Phone = mongoose.models.Phone || mongoose.model('Phone', phoneSchema);

export default Phone;
