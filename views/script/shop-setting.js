// Global state
window.shopData = [];
window.currentShopPrefix = "";
window.currentEditingPrefix = "";
window.currentEditingIndex = 0;
window.baseURL = "";

async function loadEnvConfig() {
  try {
    const res = await fetch("/api/env");
    const data = await res.json();
    window.baseURL = data.URL;   // ใช้ key = URL
    console.log("baseURL loaded:", window.baseURL);
  } catch (err) {
    console.error("❌ โหลดค่า baseURL ไม่สำเร็จ:", err);
  }
}

// โหลดข้อมูลร้านค้าทั้งหมดเมื่อหน้าเว็บโหลด
async function loadShops() {
    try {
        const response = await fetch("/api/shops");
        const data = await response.json();
        shopData = data.shops || [];
    } catch (error) {
        console.error("❌ โหลดข้อมูลร้านค้าไม่สำเร็จ:", error);
    }
}

function openShopLinesModal(prefix) {
    currentShopPrefix = prefix; // ตั้งค่า prefix ให้ถูกต้อง
    const modal = document.getElementById("shopLinesModal");
    const lineListElement = document.getElementById("line-list");
    const modalTitle = document.getElementById("modal-shop-title"); // ดึง h2

    // ค้นหาร้านค้าที่มี prefix ตรงกัน
    const shop = shopData.find(s => s.prefix === prefix);

    if (!shop) return;

    // **เติมชื่อร้านลงใน Modal**
    modalTitle.innerHTML = `
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/LINE_logo.svg/120px-LINE_logo.svg.png" id="line-logo"/>
            รายการ LINE ร้าน ${shop.name}
        `;

    // แสดงบัญชี LINE
    if (!shop.lines || shop.lines.length === 0) {
        lineListElement.innerHTML = "<p>ไม่มีบัญชี LINE</p>";
    } else {
        let html = "";
        shop.lines.forEach((line, index) => {
            html += `
                    <div class="shop-line-item">
                        <span>${line.linename}</span>
                        <div>
                            <button class="line-btn-edit" onclick="editLine('${prefix}', ${index})">แก้ไข</button>
                            <button class="line-btn-delete" onclick="deleteLine('${prefix}', ${index})">ลบ</button>
                        </div>
                    </div>
                `;
        });
        lineListElement.innerHTML = html;
    }

    modal.style.display = "flex";
}

function closeEditBankModal() {
    document.getElementById("editbankModal").style.display = "none";
}

// ปิด Modal
function closeShopLinesModal() {
    document.getElementById("shopLinesModal").style.display = "none";
}


// เปิด Modal เพิ่มบัญชี LINE
function addNewLine() {
    document.getElementById("addLineModal").style.display = "flex";

    // ดึงชื่อร้านที่เกี่ยวข้องมาแสดง
    const shop = shopData.find(s => s.prefix === currentShopPrefix);
    if (shop) {
        document.getElementById("shopNameTitle").innerText = shop.name.toUpperCase();
    }
}

// ปิด Modal เพิ่มบัญชี LINE
function closeAddLineModal() {
    document.getElementById("addLineModal").style.display = "none";
}

function showAlertMessage(message, elementId = "alertMessageAddline", isSuccess = false) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        return;
    }

    alertDiv.innerText = message;
    alertDiv.style.color = isSuccess ? "green" : "red";
    alertDiv.style.backgroundColor = isSuccess ? "#e6ffe6" : "#ffe6e6";
    alertDiv.style.border = isSuccess ? "1px solid green" : "1px solid red";
    alertDiv.style.display = "block";

    setTimeout(() => {
        alertDiv.style.display = "none";
    }, 3000);
}

// บันทึกบัญชี LINE ใหม่
async function saveNewLine() {
    try {
        const newChannelID = document.getElementById("newChannelID").value.trim();
        const newSecretToken = document.getElementById("newSecretToken").value.trim();
        if (!newChannelID || !newSecretToken) {
            showAlertMessage("กรุณากรอกข้อมูลให้ครบถ้วน!", "alertMessageAddline", false);
            return;
        }
        // ใช้ window.baseURL ที่โหลดมาก่อนหน้านี้
        if (!window.baseURL) {
            await loadEnvConfig();
        }   
        const baseURL = window.baseURL;

        const channelID = String(newChannelID).slice(-4); // ตัดเลข 4 ตัวท้าย
        const webhookURL = `${baseURL}/webhook/${currentShopPrefix}/${channelID}.bot`;

        console.log("🌐 กำลังตั้งค่า Webhook:", webhookURL);

        const tokenRes = await fetch("/api/get-access-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                channelId: newChannelID,
                secretToken: newSecretToken
            })
        });

        // log หลัง fetch สำเร็จ
        console.log("ได้รับ response แล้ว");

        const tokenData = await tokenRes.json();
        console.log("บันทึกบัญชี LINE สำเร็จ:", tokenData);

        if (!tokenData.success) {
            showAlertMessage(tokenData.message || "ขอ Access Token ไม่สำเร็จ", "alertMessageAddline", false);
            return;
        }

        const newAccessToken = tokenData.access_token;
        const lineName = tokenData.display_name || "LINE";

        // ตั้งค่า Webhook ไปที่ LINE API
        const webhookRes = await fetch("/api/set-webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                accessToken: newAccessToken,
                webhookURL: webhookURL
            })
        });

        const webhookData = await webhookRes.json();

        if (!webhookData.success) {
            console.error("❌ ตั้งค่า Webhook ไม่สำเร็จ:", webhookData);
            showAlertMessage("❌ ตั้งค่า Webhook ไม่สำเร็จ: " + (webhookData.message || "ไม่ทราบสาเหตุ"), "alertMessageAddline", false);
            return;
        }

        // ส่งไป backend เพื่อบันทึก
        const apiResponse = await fetch("/api/add-line", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prefix: currentShopPrefix,
                linename: lineName,
                access_token: newAccessToken,
                secret_token: newSecretToken,
                channel_id: newChannelID
            })
        });

        const apiResult = await apiResponse.json();
        const status = apiResponse.status;

        if (apiResult.success) {
        closeAddLineModal();
        loadShopLines(currentShopPrefix);
        } else {
        if (status === 400) {
            showAlertMessage("❌ กรุณากรอก ข้อมูลให้ครบถ้วน!", "alertMessageAddline", false);
        } else if (status === 404) {
            showAlertMessage("❌ ไม่พบร้านค้า Prefix นี้!", "alertMessageAddline", false);
        } else if (status === 409) {
            showAlertMessage("❌ ไม่สามารถเพิ่มได้: บัญชี LINE นี้มีอยู่แล้ว", "alertMessageAddline", false);
        } else if (status === 500) {
            showAlertMessage("❌ เกิดข้อผิดพลาดในการเพิ่มบัญชี LINE", "alertMessageAddline", false);
        } else {
            showAlertMessage("เกิดข้อผิดพลาด: " + apiResult.message, "alertMessageAddline", false);
        }
    }
    } catch (err) {
        console.error("❌ เกิดข้อผิดพลาดใน saveNewLine:", err);
        showAlertMessage("เกิดข้อผิดพลาดขณะบันทึกบัญชี LINE", "alertMessageAddline", false);
    }
}

async function loadShopLines(prefix) {
    console.log(`กำลังโหลดบัญชี LINE สำหรับร้าน: ${prefix}`);
    try {
        const res = await fetch("/api/shops");
        const data = await res.json();
        const shop = data.shops.find(s => s.prefix === prefix);
        if (!shop) {
            console.error("❌ ไม่พบร้านจาก API");
            return;
        }

        const lineListElement = document.getElementById("line-list");
        if (!shop.lines || shop.lines.length === 0) {
            lineListElement.innerHTML = "<p>ไม่มีบัญชีไลน์</p>";
            return;
        }

        let html = "";
        shop.lines.forEach((line, index) => {
            html += `
                <div class="shop-line-item">
                    <span>${line.linename}</span>
                    <div>
                        <button class="line-btn-edit" onclick="editLine('${prefix}', ${index})">แก้ไข</button>
                        <button class="line-btn-delete" onclick="deleteLine('${prefix}', ${index})">ลบ</button>
                    </div>
                </div>
            `;
        });

        lineListElement.innerHTML = html;
        console.log("โหลด LINE สดจาก API สำเร็จ:", shop.lines);
    } catch (err) {
        console.error("❌ โหลด LINE จาก API ไม่สำเร็จ:", err);
    }
}

async function deleteLine(prefix, index) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบบัญชีไลน์นี้?")) return;

    const shop = shopData.find(s => s.prefix === prefix);
    if (!shop) return;

    shop.lines.splice(index, 1); // ลบบัญชี LINE ออกจาก array

    // ส่งคำขอลบไปยัง API
    const response = await fetch("/api/delete-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, index })
    });

    const result = await response.json();
    if (result.success) {
        loadShopLines(prefix); // โหลดรายการใหม่
    } else {
        alert("เกิดข้อผิดพลาด: " + result.message);
    }
}

function editLine(prefix, index) {

    const shop = shopData.find(s => s.prefix === prefix);
    if (!shop) {
        console.error("❌ ไม่พบร้านค้า!");
        return;
    }

    const line = shop.lines[index];
    if (!line) {
        console.error("❌ ไม่พบบัญชี LINE!");
        return;
    }


    // ตั้งค่า prefix และ index ก่อนเปิด Modal
    currentEditingPrefix = prefix;
    currentEditingIndex = index;

    document.getElementById("editChannelID").value = line.channel_id;
    document.getElementById("editSecretToken").value = line.secret_token;

    document.getElementById("editLineModal").style.display = "flex";
}


function closeEditLineModal() {
    document.getElementById("editLineModal").style.display = "none";
}


// ฟังก์ชันบันทึกการแก้ไข
async function saveEditedLine() {
    const newChannelID = document.getElementById("editChannelID").value.trim();
    const newSecretToken = document.getElementById("editSecretToken").value.trim();

    if (!currentEditingPrefix || currentEditingPrefix.trim() === "") {
        console.log("❌ ไม่พบ prefix ร้านค้า");
        return;
    }

    if (!newChannelID || !newSecretToken) {
        showAlertMessage("กรุณากรอกข้อมูลให้ครบถ้วน!", "alertMessageEditLine", false);
        return;
    }

    try {
        // ใช้ window.baseURL ที่โหลดมาก่อนหน้านี้
        if (!window.baseURL) {
            await loadEnvConfig();
        }

        const baseURL = window.baseURL;
        const shortChannelID = String(newChannelID).slice(-4); // ใช้ 4 ตัวท้ายเพื่อแสดง Webhook
        const webhookURL = `${baseURL}/webhook/${currentShopPrefix}/${shortChannelID}.bot`;

        // ขอ Access Token
        const tokenRes = await fetch("/api/get-access-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                channelId: newChannelID,
                secretToken: newSecretToken
            })
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.success) {
            showAlertMessage(tokenData.message || "ขอ Access Token ไม่สำเร็จ", "alertMessageEditLine", false);
            return;
        }

        const newAccessToken = tokenData.access_token;
        const newLineName = tokenData.display_name || "LINE";

        // ตั้งค่า Webhook
        const webhookRes = await fetch("/api/set-webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                accessToken: newAccessToken,
                webhookURL: webhookURL
            })
        });

        const webhookData = await webhookRes.json();

        if (!webhookData.success) {
            showAlertMessage("❌ ตั้งค่า Webhook ไม่สำเร็จ", "alertMessageEditLine", false);
            return;
        }

        // ส่งไป backend เพื่ออัปเดต
        const apiResponse = await fetch("/api/update-line", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prefix: currentEditingPrefix,
                index: currentEditingIndex,
                linename: newLineName,
                access_token: newAccessToken,
                secret_token: newSecretToken,
                channel_id: newChannelID
            })
        });

        const apiResult = await apiResponse.json();

        if (apiResult.success) {
            await loadShopLines(currentEditingPrefix);
            closeEditLineModal();
        } else {
            if (apiResponse.status === 409) {
                showAlertMessage("❌ ไม่สามารถบันทึกได้: บัญชีนี้มีอยู่แล้ว (Channel ID ซ้ำ)", "alertMessageEditLine", false);
            } else if (apiResponse.status === 404) {
                showAlertMessage("❌ ไม่พบบัญชีหรือร้านค้าที่ต้องการแก้ไข", "alertMessageEditLine", false);
            } else {
                showAlertMessage(`เกิดข้อผิดพลาด: ${apiResult.message}`, "alertMessageEditLine", false);
            }
        }

    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาด:", error);
        showAlertMessage("ไม่สามารถบันทึกการเปลี่ยนแปลงได้", "alertMessageEditLine", false);
    }
}

function showAlertMessage(message, elementId = "alertMessageEditLine", isSuccess = false) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        return;
    }

    alertDiv.innerText = message;
    alertDiv.style.color = isSuccess ? "green" : "red";
    alertDiv.style.backgroundColor = isSuccess ? "#e6ffe6" : "#ffe6e6";
    alertDiv.style.border = isSuccess ? "1px solid green" : "1px solid red";
    alertDiv.style.display = "block";

    setTimeout(() => {
        alertDiv.style.display = "none";
        console.log(`ซ่อนข้อความแจ้งเตือนที่ ${elementId}`);
    }, 3000);
}


function updateShopLinesUI(prefix) {
    const shop = shopData.find(s => s.prefix === prefix);
    const lineListElement = document.getElementById("line-list");

    if (!shop || !shop.lines || shop.lines.length === 0) {
        lineListElement.innerHTML = "<p>ไม่มีบัญชีไลน์</p>";
        return;
    }

    let html = "";
    shop.lines.forEach((line, index) => {
        html += `
            <div class="shop-line-item">
                <span>${line.linename}</span>
                <div>
                    <button class="line-btn-edit" onclick="editLine('${prefix}', ${index})">แก้ไข</button>
                    <button class="line-btn-delete" onclick="deleteLine('${prefix}', ${index})">ลบ</button>
                </div>
            </div>
        `;
    });

    lineListElement.innerHTML = html;
}

async function openShopSetBotModal(prefix) {
  const shop = shopData.find(s => s.prefix === prefix);
  if (!shop) return;

  document.getElementById("shopSetbotTitle").innerText = `การตั้งค่าบอท ร้าน: ${shop.name}`;

  const slipCheckOption = shop.slipCheckOption || "duplicate";

  const html = `
        <div class="bottext-settings">
        <div class="setting-box">
            <div class="buttonsBot">
            <label class="switch-label">ปิด / เปิดการถอน</label>
            <label class="switch">
                <input type="checkbox" ${shop.statusWithdraw ? "checked" : ""}
                    onchange="updateWithdrawStatus('${prefix}', this.checked)">
                <span class="slider round"></span>
            </label>
            </div>
        </div>
        
        <div class="setting-box">
            <div class="buttonsBot">
            <label class="switch-label">ปิด / เปิดบอทตอบข้อความ</label>
            <label class="switch">
                <input type="checkbox" ${shop.statusBot ? "checked" : ""}
                    onchange="updateTextBotStatus('${prefix}', this.checked)">
                <span class="slider round"></span>
            </label>
            </div>
        </div>

        <div class="setting-option-box">
            <div class="slip-check-option">
            <label class="select-label">ตัวเลือกการตรวจสลิป</label>
            <select onchange="updateSlipCheckOption('${shop.prefix}', this.value)">
                <option value="duplicate" ${slipCheckOption === "duplicate" ? "selected" : ""}>
                ตรวจเฉพาะสลิปซ้ำ
                </option>
                <option value="all" ${slipCheckOption === "all" ? "selected" : ""}>
                ตรวจสลิปทุกแบบ
                </option>
            </select>
            </div>
        </div>

        <div class="setting-box">
        <div class="bonus-row">
            <div class="buttonsBot">
            <label class="switch-label">ปิด / เปิดการตอบ BonusTime</label>
            <label class="switch">
                <input type="checkbox" ${shop.statusBonusTime ? "checked" : ""}
                    onchange="updateBonusTimeStatus('${prefix}', this.checked, this)">
                <span class="slider round"></span>
            </label>
            </div>

            <div class="buttonsBot bonus-upload">
            <label class="switch-label">อัปโหลดรูป BonusTime</label>
            <div class="upload-row-column">
                <label for="bonusImageInput_${prefix}" class="custom-file-btn">อัปโหลดรูป</label>
                <input type="file" id="bonusImageInput_${prefix}" 
                    name="image" 
                    accept="image/*" hidden 
                    onchange="showFileName(this, '${prefix}', 'bonus')">
                <span id="bonusFileName_${prefix}" class="file-name">ยังไม่ได้เลือกไฟล์</span>
            </div>
            <div class="bonus-actions">
                <button class="bonus-btn-save" onclick="saveBonusImage('${prefix}')">บันทึก</button>
                <button class="bonus-btn-delete" onclick="deleteBonusImage('${prefix}')">ลบ</button>
            </div>
            </div>
        </div>

        <div class="bonus-preview">
        <img 
            id="bonusPreview_${prefix}" 
            src="/api/get-bonus-image?prefix=${prefix}&t=${Date.now()}" 
            alt="BonusTime Image"
            loading="lazy"
            onload="document.getElementById('bonusFileName_${prefix}').textContent='มีรูปไฟล์ภาพแล้ว';"
            onerror="this.style.display='none';"
        >
        </div>
        </div> 

        <div class="setting-box">
        <div class="password-row">
            <div class="buttonsBot">
            <label class="switch-label">ปิด / เปิดการตอบ ลืม password</label>
            <label class="switch">
                <input type="checkbox" ${shop.statusPassword  ? "checked" : ""}
                    onchange="updatePasswordStatus('${prefix}', this.checked, this)">
                <span class="slider round"></span>
            </label>
            </div>

            <div class="buttonsBot password-upload">
            <label class="switch-label">อัปโหลดรูป ลืม password</label>
            <div class="upload-row-column">
                <label for="passwordImageInput_${prefix}" class="custom-file-btn">อัปโหลดรูป</label>
                <input type="file" id="passwordImageInput_${prefix}" 
                    name="image" 
                    accept="image/*" hidden 
                    onchange="showFileName(this, '${prefix}', 'password')">
                <span id="passwordFileName_${prefix}" class="file-name">ยังไม่ได้เลือกไฟล์</span>
            </div>
            <div class="password-actions">
                <button class="password-btn-save" onclick="savePasswordImage('${prefix}')">บันทึก</button>
                <button class="password-btn-delete" onclick="deletePasswordImage('${prefix}')">ลบ</button>
            </div>
            </div>
        </div>

        <div class="password-preview">
        <img 
            id="passwordPreview_${prefix}" 
            src="/api/get-password-image?prefix=${prefix}&t=${Date.now()}" 
            alt="Password Image"
            loading="lazy"
            onload="document.getElementById('passwordFileName_${prefix}').textContent='มีรูปไฟล์ภาพแล้ว';"
            onerror="this.style.display='none';"
        >
        </div>
        </div>
  `;

  document.getElementById("shopSetbotBody").innerHTML = html;
  document.getElementById("shopSetbotModal").style.display = "flex";
}

function closeShopSetBotModal() {
  document.getElementById("shopSetbotModal").style.display = "none";
}

// ฟังก์ชันเปิด Modal แก้ไขร้านค้า
function openEditShopModal(name, prefix) {
    document.getElementById("editShopName").value = name;
    document.getElementById("editShopPrefix").value = prefix;
    currentEditingPrefix = prefix;
    document.getElementById("editShopModal").style.display = "flex";
}

// ฟังก์ชันปิด Modal
function closeEditShopModal() {
    document.getElementById("editShopModal").style.display = "none";
}

// เปิด Modal
function openAddShopModal() {
    document.getElementById("addShopModal").style.display = "flex";
}

// ปิด Modal
function closeAddShopModal() {
    document.getElementById("addShopModal").style.display = "none";
}


// ฟังก์ชันบันทึกการแก้ไขร้านค้า
async function saveShopChanges() {
    const newName = document.getElementById("editShopName").value.trim();

    if (!newName) {
        showAlertMessage("กรุณากรอกข้อมูลให้ครบถ้วน!", "alertMessageEditShop", false);
        return;
    }

    const response = await fetch("/api/update-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: currentEditingPrefix, name: newName })
    });

    const result = await response.json();
    if (result.success) {
        window.location.reload(); // รีเฟรชหน้า
    } else {
        alert("เกิดข้อผิดพลาด: " + result.message, "alertMessageEditShop", false);
    }
}

function showAlertMessage(message, elementId = "alertMessageEditShop", isSuccess = false) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        return;
    }
    alertDiv.innerText = message;
    alertDiv.style.color = isSuccess ? "green" : "red";
    alertDiv.style.backgroundColor = isSuccess ? "#e6ffe6" : "#ffe6e6";
    alertDiv.style.border = isSuccess ? "1px solid green" : "1px solid red";
    alertDiv.style.display = "block";

    setTimeout(() => {
        alertDiv.style.display = "none";
    }, 3000);
}

// ฟังก์ชันหลัก โหลดร้านค้า + render
async function loadShopsAndRender() {
    try {
        const response = await fetch("/api/shops");
        const data = await response.json();
        shopData = data.shops || [];

        const shopListElement = document.getElementById("shop-list");
        if (!shopData.length) {
            shopListElement.innerHTML = '<div class="no-shop">ยังไม่มีข้อมูลร้านค้า</div>';
            return;
        }

        let html = "";
        shopData.forEach(shop => {
            html += `
            <div class="main-page shop-item">
                <div class="shop-info ${shop.status ? "active" : "inactive"}">
                <span class="status-dot"></span>
                <span class="shop-name">${shop.name}</span>
                </div>

                <div class="buttons">
                <span class="toggle-label">เปิด / ปิดบอท</span>
                <label class="switch">
                    <input type="checkbox" ${shop.status ? "checked" : ""} onchange="handleToggle('${shop.prefix}', this)">
                    <span class="slider"></span>
                </label>
                <button class="btn btn-line" onclick="openShopLinesModal('${shop.prefix}')">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/LINE_logo.svg/120px-LINE_logo.svg.png" class="btn-logo" alt="LINE Logo"/>
                ไลน์ร้าน
                </button>
                <button class="btn btn-bank" onclick="openBankModal('${shop.prefix}')">จัดการบัญชีธนาคาร</button>
                <button class="btn btn-setBot" onclick="openShopSetBotModal('${shop.prefix}')">ตั้งค่าบอท</button>
                <button class="btn btn-edit" onclick="openEditShopModal('${shop.name}', '${shop.prefix}')">แก้ไข</button>
                <button class="btn btn-delete" onclick="deleteShop('${shop.prefix}')">ลบร้านค้า</button>
                </div>
            </div>
            `;
        });

        shopListElement.innerHTML = html;

    } catch (err) {
        console.error("❌ โหลดข้อมูลร้านค้าไม่สำเร็จ:", err);
    }
}

// Event เริ่มต้น
(async () => {
    await loadShopsAndRender();
})();

function openBankModal(prefix) {
    let modal = document.getElementById("bankModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "bankModal";
        modal.className = "modal";
        document.body.appendChild(modal);
    }

    modal.style.display = "flex";  // เปิด Modal

    fetch("/api/bank-accounts")
        .then((res) => res.json())
        .then((data) => {
            const accounts = data.accounts[prefix] || [];
            const listContainer = document.getElementById("bank-list");
            const bankTitle = document.getElementById("BankTitle");

            listContainer.innerHTML = "";
            const shop = shopData.find(s => s.prefix === prefix);
            if (shop) {
                shop.bankAccounts = accounts;
                bankTitle.textContent = `รายการบัญชีธนาคารร้าน: ${shop.name}`;
            }

            if (accounts.length === 0) {
                listContainer.innerHTML = "<p>ยังไม่มีบัญชีธนาคารสำหรับร้านนี้</p>";
            } else {
                accounts.forEach((account, index) => {
                    const row = document.createElement("div");
                    row.className = "bank-row";
                    row.innerHTML = `
              <div class="shop-info ${account.status ? "active" : "inactive"}">
                <span class="status-dot"></span>
                <span class="shop-name">${account.name}</span>
              </div>
              <div class="slip-check-option">
                <label class="switchBank">
                  <input type="checkbox" ${account.status ? "checked" : ""} onchange="toggleBankStatus('${prefix}', ${index}, this)">
                  <span class="slider"></span>
                </label>
              </div>
              <div class="buttons">
                <button class="line-btn-edit" onclick="openEditBankModal('${prefix}', ${index})">แก้ไข</button>
                <button class="line-btn-delete" onclick="deleteBank('${prefix}', ${index})">ลบ</button>
              </div>
            `;
                    listContainer.appendChild(row);
                });
            }

            // เพิ่มปุ่มด้านล่างรายการ
            const addBtn = document.createElement("button");
            addBtn.className = "btn btn-add-bank";
            addBtn.textContent = "+ เพิ่มธนาคารใหม่";
            addBtn.style.marginTop = "30px";
            addBtn.style.fontSize = "16px";
            addBtn.style.padding = "10px 20px";
            addBtn.style.borderRadius = "8px";
            addBtn.addEventListener("click", () => openAddBankModal(prefix));
            listContainer.appendChild(addBtn);
            
            modal.style.display = "flex";
        })
        .catch((err) => {
            console.error("เกิดข้อผิดพลาดในการโหลดบัญชีธนาคาร:", err);
        });
}

function openAddBankModal(prefix) {
    const modal = document.getElementById("addbankModal");

    if (!modal) {
        console.error("❌ ไม่พบ modal addbankModal");
        return;
    }

    modal.style.display = "flex";
    modal.dataset.prefix = prefix;  // เก็บ prefix ไว้ใน modal

    const shop = shopData.find(s => s.prefix === prefix);
    if (!shop) {
        console.error("❌ ไม่พบข้อมูลร้านสำหรับ prefix:", prefix);
        document.getElementById("lineShopNameTitle").textContent = "ไม่พบร้าน";
        return;
    }

    document.getElementById("lineShopNameTitle").textContent = `เพิ่มบัญชีธนาคารสำหรับร้าน: ${shop.name}`;
    document.getElementById("bankAccountName").value = "";
    document.getElementById("bankAccountNumber").value = "";
}

// ปิด Modal
function closeAddBankModal() {
    document.getElementById("addbankModal").style.display = "none";
}

function closeBankModal() {
    const modal = document.getElementById("bankModal");
    if (modal) {
        modal.style.display = "none";  // ซ่อน Modal
    }
}

async function toggleBankStatus(prefix, index, checkbox) {
    const newStatus = checkbox.checked;
    try {
        const res = await fetch("/api/update-bank-status", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ prefix, index, status: newStatus }),
        });

        const result = await res.json();
        if (result.success) {
            openBankModal(prefix);
        } else {
            alert("ไม่สามารถอัปเดตสถานะบัญชีได้: " + result.message);
            checkbox.checked = !newStatus;
        }
    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการอัปเดตสถานะบัญชีธนาคาร", err);
        alert("เกิดข้อผิดพลาดในการอัปเดตสถานะบัญชีธนาคาร");
        checkbox.checked = !newStatus;
    }
}

function openEditBankModal(prefix, index) {
    const modal = document.getElementById("editbankModal");
    const shop = shopData.find(s => s.prefix === prefix);
    if (!shop || !shop.bankAccounts || !shop.bankAccounts[index]) {
        console.error("ไม่พบข้อมูลร้านหรือบัญชีธนาคาร");
        return;
    }

    const account = shop.bankAccounts[index];
    document.getElementById("editBankAccountName").value = account.name;
    document.getElementById("editBankAccountNumber").value = account.account;

    // บันทึก prefix และ index ไว้ใน data attribute ของ modal
    modal.dataset.prefix = prefix;
    modal.dataset.index = index;

    modal.style.display = "flex";
}

function closeEditBankModal() {
    document.getElementById("editbankModal").style.display = "none";
}

function showAlertMessage(message, elementId = "alertMessageAddBank", isSuccess = false) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        return;
    }
    alertDiv.innerText = message;
    alertDiv.style.color = isSuccess ? "green" : "red";
    alertDiv.style.backgroundColor = isSuccess ? "#e6ffe6" : "#ffe6e6";
    alertDiv.style.border = isSuccess ? "1px solid green" : "1px solid red";
    alertDiv.style.display = "block";

    setTimeout(() => {
        alertDiv.style.display = "none";
    }, 3000);
}

function showAlertMessage(message, elementId = "alertMessageEditBank", isSuccess = false) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        return;
    }
    alertDiv.innerText = message;
    alertDiv.style.color = isSuccess ? "green" : "red";
    alertDiv.style.backgroundColor = isSuccess ? "#e6ffe6" : "#ffe6e6";
    alertDiv.style.border = isSuccess ? "1px solid green" : "1px solid red";
    alertDiv.style.display = "block";

    setTimeout(() => {
        alertDiv.style.display = "none";
    }, 3000);
}


function saveNewBank() {
    const modal = document.getElementById("addbankModal");
    const prefix = modal.dataset.prefix; // ดึง prefix จาก modal
    const name = document.getElementById("bankAccountName").value.trim();
    const number = document.getElementById("bankAccountNumber").value.trim();

    if (!name || !number) {
        showAlertMessage("กรุณากรอกชื่อบัญชีและเลขบัญชีให้ครบ", "alertMessageAddBank", false);
        return;
    }

    fetch("/api/add-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, name, number })
    })
    .then(res => res.json())
    .then(result => {
        if (result.success) {
            closeAddBankModal();
            openBankModal(prefix); // โหลดใหม่
            restartWebhooks();
        } else {
            showAlertMessage("❌ ไม่สามารถเพิ่มบัญชีธนาคารได้: " + result.message, "alertMessageAddBank", false);
        }
    })
    .catch(err => {
        console.error("เกิดข้อผิดพลาดในการเพิ่มบัญชีธนาคาร", err);
    });
}

function saveEditedBank() {
    const modal = document.getElementById("editbankModal");
    const prefix = modal.dataset.prefix;
    const index = Number(modal.dataset.index); // อย่าลืมแปลงเป็น number

    const name = document.getElementById("editBankAccountName").value.trim();
    const number = document.getElementById("editBankAccountNumber").value.trim();

    if (!name || !number) {
        showAlertMessage("กรุณากรอกชื่อบัญชีและเลขบัญชีให้ครบ", "alertMessageEditBank", false);
        return;
    }

    fetch("/api/edit-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, index, name, number }),
    })
    .then(res => res.json())
    .then(result => {
        if (result.success) {
            closeEditBankModal();
            openBankModal(prefix);
        } else {
            showAlertMessage("❌ ไม่สามารถแก้ไขบัญชีธนาคารได้: " + result.message, "alertMessageEditBank", false);
        }
    })
    .catch(err => {
        console.error("เกิดข้อผิดพลาดในการแก้ไขบัญชีธนาคาร:", err);
        showAlertMessage("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", "alertMessageEditBank", false);
    });
}

function deleteBank(prefix, index) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบบัญชีนี้?")) return;
    fetch("/api/delete-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, index }),
    })
        .then((res) => res.json())
        .then((result) => {
            if (result.success) {
                openBankModal(prefix);
            } else {
                alert("ไม่สามารถลบบัญชีธนาคารได้: " + result.message);
            }
        })
        .catch((err) => {
            console.error("เกิดข้อผิดพลาดในการลบบัญชีธนาคาร", err);
        });
}


function showAlertMessage(message, elementId = "alertMessageShop", isSuccess = false) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        return;
    }
    alertDiv.innerText = message;
    alertDiv.style.color = isSuccess ? "green" : "red";
    alertDiv.style.backgroundColor = isSuccess ? "#e6ffe6" : "#ffe6e6";
    alertDiv.style.border = isSuccess ? "1px solid green" : "1px solid red";
    alertDiv.style.display = "block";

    setTimeout(() => {
        alertDiv.style.display = "none";
    }, 3000);
}

async function addShop() {
    const shopName = document.getElementById("shopName").value.trim();
    const shopPrefix = document.getElementById("shopPrefix").value.trim();

    if (!shopName || !shopPrefix) {
        showAlertMessage("กรุณากรอกข้อมูลให้ครบถ้วน!", "alertMessageShop", false);
        return;
    }

    const response = await fetch("/api/add-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: shopName, prefix: shopPrefix })
    });

    const result = await response.json();
    if (result.success) {
        window.location.reload(); // รีเฟรชหน้า
    } else {
        showAlertMessage(result.message, "alertMessageShop", false);
    }
}

function closeBotSettingsModal() {
    document.getElementById("botSettingsModal").style.display = "none";
}


// ฟังก์ชันสำหรับอัปเดตสถานะร้านผ่าน API
async function updateShopStatus(prefix, newStatus) {
    try {
        const response = await fetch("/api/update-shop-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, status: newStatus })
        });

        const result = await response.json();
        if (result.success) {
        } else {
            console.error(`❌ ไม่สามารถอัปเดตสถานะร้าน: ${result.message}`);
        }
    } catch (error) {
        console.error("❌ Error updating shop status:", error);
    }
}

// ฟังก์ชันสำหรับจัดการสวิตช์ (Toggle) เมื่อมีการเปลี่ยนแปลง
async function handleToggle(prefix, checkbox) {
    const newStatus = checkbox.checked; // true: เปิด, false: ปิด
    try {
        const response = await fetch("/api/update-shop", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prefix, status: newStatus })
        });

        const result = await response.json();
        if (result.success) {
            window.location.reload(); // รีโหลดหน้าเพื่ออัปเดตข้อมูล
        } else {
            alert("❌ ไม่สามารถอัปเดตสถานะร้านค้าได้: " + result.message);
            checkbox.checked = !newStatus; // กลับสถานะเดิมถ้าล้มเหลว
        }
    } catch (error) {
        console.error("Error updating shop status:", error);
        alert("❌ เกิดข้อผิดพลาดในการอัปเดตสถานะร้านค้า");
        checkbox.checked = !newStatus; // กลับสถานะเดิมถ้าล้มเหลว
    }
}

// ฟังก์ชันสำหรับลบร้านค้า
async function deleteShop(prefix) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบร้านค้า?")) return;
    try {
        const response = await fetch("/api/delete-shop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix })
        });
        if (!response.ok) {
            throw new Error("ไม่สามารถลบร้านค้าได้");
        }
        const result = await response.json();
        if (result.success) {
            window.location.reload();
        } else {
            alert("ไม่สามารถลบร้านค้าได้");
        }
    } catch (error) {
        console.error("Error deleting shop:", error);
        alert("เกิดข้อผิดพลาดในการลบร้านค้า");
    }
}

async function updateTextBotStatus(prefix, newStatusBot) {
    try {
        const response = await fetch("/api/update-textbot-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, statusBot: newStatusBot })
        });

        const result = await response.json();
        if (!result.success) {
            console.error(`❌ ไม่สามารถอัปเดตสถานะบอทข้อความ: ${result.message}`);
        }
    } catch (error) {
        console.error("❌ Error updating text bot status:", error);
    }
}

async function updateWithdrawStatus(prefix, newWithdrawStatus) {
    try {
        const response = await fetch("/api/update-withdraw-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, statusWithdraw: newWithdrawStatus })
        });

        const result = await response.json();
        if (!result.success) {
            console.error(`❌ ไม่สามารถอัปเดตสถานะ เปิด/ปิด ถอน: ${result.message}`);
        }
    } catch (error) {
        console.error("❌ Error updating withdraw status:", error);
    }
}

async function updateBonusTimeStatus(prefix, newBonusTimeStatus, checkbox) {
  try {
    if (newBonusTimeStatus) {
      const check = await fetch(`/api/get-bonus-image?prefix=${prefix}&t=${Date.now()}`);
      if (!check.ok) {
        alert("❌ กรุณาอัปโหลดรูป BonusTime ก่อนเปิดการใช้งาน");
        if (checkbox) checkbox.checked = false; // ใช้ parameter checkbox
        return;
      }
    }

    // อัปเดตสถานะจริง
    const response = await fetch("/api/update-bonusTime-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, statusBonusTime: newBonusTimeStatus })
    });

    const result = await response.json();
    if (!result.success) {
      console.error(`❌ ไม่สามารถอัปเดตสถานะ BonusTime: ${result.message}`);
    }
  } catch (error) {
    console.error("❌ Error updating BonusTime status:", error);
  }
}

async function updatePasswordStatus(prefix, newPasswordStatus, checkbox) {
  try {
    if (newPasswordStatus) {
      const check = await fetch(`/api/get-password-image?prefix=${prefix}&t=${Date.now()}`);
      if (!check.ok) {
        alert("❌ กรุณาอัปโหลดรูปลืม password ก่อนเปิดการใช้งาน");
        if (checkbox) checkbox.checked = false; // ใช้ parameter checkbox
        return;
      }
    }

    // อัปเดตสถานะจริง
    const response = await fetch("/api/update-password-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, statusPassword: newPasswordStatus })
    });

    const result = await response.json();
    if (!result.success) {
      console.error(`❌ ไม่สามารถอัปเดตสถานะ Password: ${result.message}`);
    }
  } catch (error) {
    console.error("❌ Error updating Password status:", error);
  }
}

function showFileName(input, prefix, type) {
  const file = input.files[0];
  const fileNameSpan = document.getElementById(
    type === "bonus" 
      ? `bonusFileName_${prefix}` 
      : `passwordFileName_${prefix}`
  );

  if (file) {
    let name = file.name;

    // ถ้าชื่อยาวเกิน 30 ตัวอักษร → ตัดกลางออก
    if (name.length > 30) {
      const start = name.substring(0, 10);
      const end = name.substring(name.length - 10);
      name = `${start}...${end}`;
    }

    fileNameSpan.textContent = name;
  } else {
    fileNameSpan.textContent = "ยังไม่ได้เลือกไฟล์";
  }
}


async function deleteBonusImage(prefix) {
    try {
        const response = await fetch("/api/delete-bonus-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix })
        });

        const result = await response.json();
        if (result.success) {
            const img = document.getElementById(`bonusPreview_${prefix}`);
            if (img) img.style.display = "none";

            const fileNameSpan = document.getElementById(`fileName_${prefix}`);
            if (fileNameSpan) fileNameSpan.innerText = "ยังไม่ได้เลือกไฟล์";

            const switchInput = document.querySelector(
                `input[type="checkbox"][onchange*="updateBonusTimeStatus('${prefix}"]`
            );
            if (switchInput) {
                switchInput.checked = false;
            }
            
            await fetch("/api/update-bonusTime-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prefix, statusBonusTime: false })
            });
        } else {
            alert("ไม่สามารถลบรูปได้: " + result.message);
        }
    } catch (err) {
        console.error("❌ Error deleting bonus image:", err);
        alert("เกิดข้อผิดพลาดในการลบรูป");
    }
}

async function deletePasswordImage(prefix) {
    try {
        const response = await fetch("/api/delete-password-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix })
        });

        const result = await response.json();
        if (result.success) {
            const img = document.getElementById(`passwordPreview_${prefix}`);
            if (img) img.style.display = "none";

            const fileNameSpan = document.getElementById(`fileName_${prefix}`);
            if (fileNameSpan) fileNameSpan.innerText = "ยังไม่ได้เลือกไฟล์";

            const switchInput = document.querySelector(
                `input[type="checkbox"][onchange*="updatePasswordStatus('${prefix}"]`
            );
            if (switchInput) {
                switchInput.checked = false;
            }
            
            await fetch("/api/update-password-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prefix, statusPassword: false })
            });
        } else {
            alert("ไม่สามารถลบรูปได้: " + result.message);
        }
    } catch (err) {
        console.error("❌ Error deleting password image:", err);
        alert("เกิดข้อผิดพลาดในการลบรูป");
    }
}


async function saveBonusImage(prefix) {
  const input = document.getElementById(`bonusImageInput_${prefix}`);
  if (!input.files.length) {
    alert("กรุณาเลือกรูปก่อนบันทึก");
    return;
  }

  const formData = new FormData();
  formData.append("image", input.files[0]);
  formData.append("prefix", prefix);

  try {
    const res = await fetch("/api/upload-bonus-image", {
      method: "POST",
      body: formData
    });

    const result = await res.json();
    if (result.success) {
      const preview = document.getElementById(`bonusPreview_${prefix}`);
      preview.src = `/api/get-bonus-image?prefix=${prefix}&t=${Date.now()}`;
      preview.style.display = "block";
    } else {
      alert("❌ บันทึกภาพไม่สำเร็จ");
    }
  } catch (err) {
    console.error("❌ Error uploading image:", err);
  }
}

async function savePasswordImage(prefix) {
  const input = document.getElementById(`passwordImageInput_${prefix}`);
  if (!input.files.length) {
    alert("กรุณาเลือกรูปก่อนบันทึก");
    return;
  }

  const formData = new FormData();
  formData.append("image", input.files[0]);
  formData.append("prefix", prefix);

  try {
    const res = await fetch("/api/upload-password-image", {
      method: "POST",
      body: formData
    });

    const result = await res.json();
    if (result.success) {
      const preview = document.getElementById(`passwordPreview_${prefix}`);
      preview.src = `/api/get-password-image?prefix=${prefix}&t=${Date.now()}`;
      preview.style.display = "block";
    } else {
      alert("❌ บันทึกภาพไม่สำเร็จ");
    }
  } catch (err) {
    console.error("❌ Error uploading image:", err);
  }
}

async function updateSlipCheckOption(prefix, newOption) {
    try {
        const response = await fetch("/api/update-slip-option", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, slipCheckOption: newOption })
        });

        const result = await response.json();
        if (result.success) {
            window.location.reload(); // รีโหลดหน้าหลังจากเปลี่ยนตัวเลือก
        } else {
            alert(`❌ ไม่สามารถอัปเดตตัวเลือกตรวจสลิป: ${result.message}`);
        }
    } catch (error) {
        console.error("❌ Error updating slip check option:", error);
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("/api/shops");
        const data = await response.json();
        const shopListElement = document.getElementById("shop-list");

        if (!data.shops || data.shops.length === 0) {
            shopListElement.innerHTML = '<div class="no-shop">ยังไม่มีข้อมูลร้านค้า</div>';
            return;
        }

    } catch (error) {
        console.error("ไม่สามารถโหลดข้อมูลร้านค้า:", error);
    }
});

