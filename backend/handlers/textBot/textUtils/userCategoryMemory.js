const userSavedCategories = new Map();
const userCategoryTimestamps  = new Map();
const ignoreCategoryCounters = new Map();

// บันทึก category พร้อม timestamp
function saveCategoryForUser(userId, category) {
  const now = Date.now();

  if (!userSavedCategories.has(userId)) {
    userSavedCategories.set(userId, []);
  }

  const entry = { category, timestamp: now };
  userSavedCategories.get(userId).push(entry);
}

// ตรวจสอบว่าภายใน 15 นาทีมี category นี้ไหม
function hasCategory(userId, targetCategory) {
  const now = Date.now();
  const history = userSavedCategories.get(userId) || [];

  const result = history.some(entry =>
    entry.category === targetCategory &&
    now - entry.timestamp <= 15 * 60 * 1000
  );

  return result;
}

// ตรวจสอบว่าภายใน 1.5 ชั่วโมงมี category นี้ไหม
function hasCategoryInHour(userId, targetCategory) {
  const now = Date.now();
  const history = userSavedCategories.get(userId) || [];

  return history.filter(entry =>
    entry.category === targetCategory &&
    now - entry.timestamp <= 90 * 60 * 1000
  ).length;
}

// ลบประวัติทั้งหมดของ userId (เผื่อต้องการ clear)
function clearUserCategoryHistory(userId) {
  userSavedCategories.delete(userId);
}

// ตรวจสอบว่าภายใน 2 นาทีนี้ตอบ category ไปยัง
function shouldReplyCategory(userId, category, cooldownSeconds = 120) {
  const now = Date.now();

  // หมวดที่ตอบได้ทันที แต่เช็ค spam รวมกันทุกหมวด
  const ignoreCategory = ['complain_loss', 'offensive'];

  if (ignoreCategory.includes(category)) {
    const counter = ignoreCategoryCounters.get(userId);

    if (!counter) {
      // ยังไม่เคยมีข้อมูล → เริ่มนับใหม่
      ignoreCategoryCounters.set(userId, { count: 1, firstTimestamp: now });
      return true;
    }

    const timeSinceFirst = now - counter.firstTimestamp;

    if (timeSinceFirst > cooldownSeconds * 1000) {
      // เกินเวลา → รีเซ็ตนับใหม่
      ignoreCategoryCounters.set(userId, { count: 1, firstTimestamp: now });
      return true;
    }

    if (counter.count >= 5) {
      // ส่งเกิน 5 ครั้ง (รวมกันทุกหมวดใน ignoreCategory) ภายในช่วงเวลา → เพิกเฉย
      return false;
    }

    // ยังไม่ถึง 5 → เพิ่ม count แล้วตอบได้
    counter.count += 1;
    return true;
  }

  if (!userCategoryTimestamps.has(userId)) {
    userCategoryTimestamps.set(userId, new Map());
  }

  const categoryMap = userCategoryTimestamps.get(userId);
  const lastTimestamp = categoryMap.get(category);
  const isWithinCooldown = lastTimestamp && now - lastTimestamp < cooldownSeconds * 1000;

  if (isWithinCooldown) {
    return false;
  }

  categoryMap.set(category, now);
  return true;
}

export {
  saveCategoryForUser,
  hasCategory,
  hasCategoryInHour,
  clearUserCategoryHistory,
  shouldReplyCategory
};
