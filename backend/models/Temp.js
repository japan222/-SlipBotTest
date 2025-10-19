// models/Credentials.js
import mongoose from "mongoose";

const roleSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true }
});

// ใช้ schema หลักที่เก็บเป็นกลุ่ม role
const credentialsSchema = new mongoose.Schema({
  OWNER: [roleSchema],
  ADMIN: [roleSchema],
  MARKETING: [roleSchema]
});

const Credentials =
  mongoose.models.Credentials ||
  mongoose.model("Credentials", credentialsSchema);

export default Credentials;