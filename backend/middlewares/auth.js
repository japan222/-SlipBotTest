// middlewares/auth.js

export function isAuthenticated(req, res, next) {
  if (req.session?.user) return next();

  // ตรวจสอบว่ามาจาก request ประเภท API หรือหน้าเว็บ
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(401).json({ success: false, message: "ยังไม่ได้เข้าสู่ระบบ" });
  } else {
    return res.redirect("/login");
  }
}