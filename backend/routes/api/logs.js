// routes/api/logs.js
import express from "express";
import { addLogClient, removeLogClient, getLogHistory } from "../../utils/logManager.js";

const router = express.Router();

router.get("/logs", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // ส่ง log ย้อนหลัง
  getLogHistory().forEach(log => {
    res.write(`data: ${log}\n\n`);
  });

  // สมัคร client
  addLogClient(res);

  // ลบ client เมื่อปิดการเชื่อมต่อ
  req.on("close", () => removeLogClient(res));
});

export default router;