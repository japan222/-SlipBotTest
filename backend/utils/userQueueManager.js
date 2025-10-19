// utils/userQueueManager.js
const activeUserTasks = new Map();

/**
 * เช็คว่า user นี้กำลังประมวลผลอยู่ไหม
 */
function isUserBusy(userId) {
  return activeUserTasks.has(userId);
}

/**
 * พยายามเริ่ม task สำหรับ user นี้
 * - ถ้ายังไม่ว่าง: ❌ ปฏิเสธ
 * - ถ้าว่าง: ✅ เริ่มทันที
 */
function addToUserQueue(userId, taskFn) {
  if (isUserBusy(userId)) {
    console.warn(`❌ [${userId}] ยังไม่เสร็จงานเก่า → เพิกเฉยงานใหม่`);
    return false;
  }

  // ✅ กำลังประมวลผล
  activeUserTasks.set(userId, true);

  taskFn()
    .then(() => finishUserTask(userId))
    .catch((err) => {
      console.error(`❌ [${userId}] Task error:`, err);
      finishUserTask(userId);
    });

  return true;
}

/**
 * งานของ user เสร็จแล้ว
 */
function finishUserTask(userId) {
  activeUserTasks.delete(userId);
}


export { addToUserQueue, finishUserTask };
