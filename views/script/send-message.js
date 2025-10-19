let foundUsersFull = []; // เก็บไว้ส่งข้อความภายหลัง [{ userId, prefix, accessToken }]
let uploadedImageURL = null;

window.addEventListener("beforeunload", async () => {
  try {
    // ใช้ session cookie อัตโนมัติ (เพราะมี credentials: 'include' อยู่แล้ว)
    const res = await fetch("/api/delete-my-upload", {
      method: "DELETE",
      credentials: "include" // ส่ง sessionId ไปด้วย
    });

    if (res.ok) {
      console.log("ลบรูปภาพตอนรีเฟรชเรียบร้อย");
    } else {
      console.warn("ลบรูปภาพตอนรีเฟรชไม่สำเร็จ");
    }
  } catch (err) {
    console.error("❌ Error ตอนพยายามลบภาพก่อน unload:", err);
  }
});

async function handleImageSelect(event) {
  const file = event.target.files[0];
  const previewImg = document.getElementById('preview-img');
  const previewWrapper = document.getElementById('preview-image');

  if (!file) return;

  // แสดง preview ทันที (Base64)
  const reader = new FileReader();
  reader.onload = function (e) {
    uploadedImageURL = e.target.result;
    previewImg.src = uploadedImageURL;
    previewWrapper.style.display = 'none'; // ซ่อนไว้ก่อนจนกว่าจะอัปโหลดสำเร็จ
  };
  reader.readAsDataURL(file);

  // เรียกอัปโหลดทันที
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/upload-send-image-line', {
      method: 'POST',
      body: formData,
      credentials: 'include'  // ✅ เพื่อส่ง cookie session ไปด้วย
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log("✅ อัปโหลดสำเร็จ:", data);
      previewWrapper.style.display = 'block';
      previewImg.title = `ดูภาพ (ID: ${data.fileId || ''})`;
      alert('อัปโหลดเรียบร้อยแล้ว!');
    } else {
      console.error('❌ อัปโหลดล้มเหลว:', data);
      alert('อัปโหลดล้มเหลว โปรดลองใหม่');
    }
  } catch (err) {
    console.error('❌ Upload error:', err);
    alert('เกิดข้อผิดพลาดในการอัปโหลด');
  }
}

async function lookupUser() {
  const input = document.getElementById("userId");
  const rawInput = input?.value?.trim();

  const lookupStatus = document.getElementById("lookup-status");
  const userNotFound = document.getElementById("user-not-found");

  lookupStatus.textContent = "กำลังค้นหา...";
  lookupStatus.style.color = "black";
  userNotFound.textContent = "";

  if (!rawInput) {
    lookupStatus.textContent = "* กรุณากรอกข้อมูลผู้ใช้ก่อน";
    lookupStatus.style.color = "orange";
    return;
  }

  const userList = [...new Set(extractUserIds(rawInput))];
  if (userList.length === 0) {
    lookupStatus.textContent = "* ไม่พบรหัสผู้ใช้ที่ถูกต้อง";
    lookupStatus.style.color = "orange";
    return;
  }

  try {
    const res = await fetch('/api/user-lookup-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: userList }),
    });
    const data = await res.json();

    foundUsersFull = [];
    const notFoundUsers = [];

    for (const user of data.results) {
      if (user.found) {
        foundUsersFull.push({
          userId: user.userId,
          prefix: user.username.substring(0, 3),
          accessToken: user.accessToken,
        });
      } else {
        notFoundUsers.push(user.username);
      }
    }

    const foundCount = foundUsersFull.length;
    const color = foundCount === 0 ? "red" : (foundCount < userList.length ? "orange" : "green");
    lookupStatus.innerHTML = `พบ USER : <span style="color:${color}">${foundCount} / ${userList.length}</span> คน`;

    if (notFoundUsers.length > 0) {
      const displayLimit = 24;
      const shownUsers = notFoundUsers.slice(0, displayLimit);
      const result = "ไม่พบ USER : " + shownUsers.join(", ") + (notFoundUsers.length > displayLimit ? " ..." : "");
      userNotFound.textContent = result;
      userNotFound.style.color = "gray";
    }

  } catch (err) {
    console.error("❌ Error in batch lookup:", err);
    lookupStatus.textContent = "เกิดข้อผิดพลาดระหว่างค้นหา";
    lookupStatus.style.color = "red";
  }
}

function extractUserIds(rawInput) {
  // แปลงเป็นพิมพ์ใหญ่ก่อน แล้วลบช่องว่าง, comma และ newline
  const cleanInput = rawInput.toUpperCase().replace(/[\s,]+/g, "");

  const matches = [];
  const regex = /([A-Z]{3})(\d+)/g;
  let match;

  while ((match = regex.exec(cleanInput)) !== null) {
    const prefix = match[1];
    const digits = match[2];
    matches.push(prefix + digits);
  }

  return matches;
}

async function sendMessageToFoundUsers(event) {
  if (event) event.preventDefault();

  const message = document.getElementById("message")?.value?.trim();

  if (!message && !uploadedImageURL) {
    alert("กรุณากรอกข้อความหรือเลือกรูปภาพก่อนส่ง");
    return;
  }

  if (!foundUsersFull || foundUsersFull.length === 0) {
    alert("ยังไม่มีผู้ใช้ที่ค้นหาเจอ");
    return;
  }

  sendMessageLog("📤 กำลังส่ง ...");

  for (const user of foundUsersFull) {
    const { userId, shopName = "ไม่ทราบชื่อร้าน" } = user;

    try {
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("message", message || "");

      // ✅ ถ้ามีรูปภาพ ให้ดึง blob จาก URL แล้วแนบไป
      if (uploadedImageURL) {
        const response = await fetch(uploadedImageURL);
        const blob = await response.blob();
        const contentType = blob.type || "image/jpeg";
        const extension = contentType.split("/")[1] || "jpg";

        formData.append("image", blob, `uploaded-image.${extension}`);
      }

      const res = await fetch("/api/send-message", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const raw = await res.text();
        throw new Error(`ไม่ได้ response เป็น JSON (HTML): ${raw.slice(0, 100)}`);
      }

      const data = await res.json();

      if (data.success) {
        const usedLine = data.usedLine || "ไม่ระบุ";
        sendMessageLog(`✅ ส่งให้ ${userId} ร้าน ${shopName} สำเร็จ (LINE: ${usedLine})`);
      } else {
        sendMessageLog(`❌ ส่งไม่สำเร็จ: ${userId} ร้าน ${shopName} - ${data.error || "Unknown error"}`);
      }

    } catch (err) {
      sendMessageLog(`❌ Error: ${userId} - ${err.message}`);
    }
  }

  sendMessageLog("🎉 เสร็จสิ้นการส่งข้อความและรูปภาพแล้วค่ะ");
}

function sendMessageLog(message) {
  const logBox = document.getElementById("statusBox");
  if (logBox) {
    const p = document.createElement("p");
    p.textContent = message;
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
  }
}