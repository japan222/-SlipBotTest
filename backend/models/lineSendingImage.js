// models/lineSendingImage.js
import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema({
  data: Buffer,
  contentType: String,
  username: String,
  sessionId: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

ImageSchema.index({ uploadedAt: 1 }, { expireAfterSeconds: 300 });

export default mongoose.model("UploadedImage", ImageSchema);