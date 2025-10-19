// Global state for SSE connection
window._sseConnected = false;
window.slipResults = [];
window.visibleCount = 100;
window.baseURL = ""; // Global

// Utility functions
function escapeHTML(str) {
  const div = document.createElement("div");
  div.innerText = str;
  return div.innerHTML;
}

function showLoading(message = "กำลังโหลด...") {
  const content = document.getElementById("main-content");
  content.innerHTML = `<p style="text-align:center; font-size:18px; color:#555;">${message}</p>`;
}

// Page navigation
function loadPage(event, page) {
  if (event) event.preventDefault?.();

  // Clear active class
  const links = document.querySelectorAll(".sidebar li");
  links.forEach(link => link.classList.remove("active"));

  if (event?.target?.tagName === "LI") {
    event.target.classList.add("active");
  }

  showLoading();

  fetch(`/page/${page}`)
    .then(res => {
      if (!res.ok) throw new Error("ไม่สามารถโหลดหน้าได้");
      return res.text();
    })
    .then(html => {
      const container = document.getElementById("main-content");
      container.innerHTML = html;

      // Load scripts from innerHTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const scripts = tempDiv.querySelectorAll("script[src]");

      let loaded = 0;
      if (scripts.length === 0) return finalize(); // ไม่มีสคริปต์

      scripts.forEach(tag => {
        const script = document.createElement("script");
        script.src = tag.src;
        script.onload = () => {
          loaded++;
          if (loaded === scripts.length) finalize();
        };
        document.body.appendChild(script);
      });
    })
    .catch(err => {
      document.getElementById("main-content").innerHTML = 
        `<p style="color:red">เกิดข้อผิดพลาด: ${err.message}</p>`;
    });

  function finalize() {
    console.log("✅ finalize", page);  // ดูว่าเรียกไหม
    switch (page) {
      case "dashboard":
        if (typeof initDashboardBot === "function") {
          initDashboardBot();
          setupSSE(); // เชื่อม SSE สำหรับ Dashboard
        }
        break;

      case "settings":
        if (typeof loadSettings === "function") {
          loadSettings();
        }
        break;

      case "shop-setting":
        if (typeof loadShopsAndRender === "function") loadShopsAndRender();
        break;

      case "send-message":
        console.log("🔥 กำลังเช็ค typeof loadSendMessage:", typeof loadSendMessage);
        if (typeof loadSendMessage === "function") {
          loadSendMessage();
        }
        break;
    }
  }
}

// SSE setup and handling
function setupSSE() {
  if (window._sseConnected) return;

  const sse = new EventSource("/events");

  sse.onopen = () => console.log("SSE opened");
  sse.onerror = (e) => console.error("SSE error", e);
  sse.onmessage = (event) => {
    try {
      const newSlip = JSON.parse(event.data);

      window.slipResults.unshift(newSlip); // ดันรายการใหม่ขึ้นบนสุด

      const tbody = document.getElementById("slip-results-body");
      if (tbody) {
        tbody.innerHTML = "";
        renderSlipResults(0, window.visibleCount);
      }
    } catch (err) {
      console.error("❌ Error parsing SSE:", err);
    }
  };

  window._sseConnected = true;
}

// Navigation helper
function navigateTo(e, page) {
  loadPage(e, page);
}

// เริ่มต้นโหลดหน้าแรกเมื่อเว็บโหลดเสร็จ
window.addEventListener("DOMContentLoaded", () => {
  loadPage(null, "dashboard");
});

// ส่งออก global
window.navigateTo = navigateTo;
window.loadPage = loadPage;
window.escapeHTML = escapeHTML;
window.showLoading = showLoading;