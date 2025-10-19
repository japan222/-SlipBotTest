// models/Prefix.js
import mongoose from "mongoose";

const statSchema = new mongoose.Schema({
  prefix: { type: String, required: true, trim: true },
});

export default mongoose.model("Prefix", statSchema);