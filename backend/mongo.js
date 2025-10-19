// mongo.js
import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";

const envPath = path.join(process.cwd(), "info.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connect failed:", err.message);
    // retry only if initial connect fails
    setTimeout(() => {
      connectDB();
    }, 5000);
  }
}

let reconnecting = false;

// เมื่อ disconnected → ลอง reconnect
mongoose.connection.on("disconnected", () => {
  if (!reconnecting) {
    console.warn("⚠️ MongoDB disconnected. Reconnecting...");
    reconnecting = true;
    setTimeout(async () => {
      await connectDB();
      reconnecting = false;
    }, 5000);
  }
});

// เมื่อ error → log ไว้
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err.message);
  
});

export default mongoose;
