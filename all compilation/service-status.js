function getApiBase() {
  return window.API_BASE || "https://miyummybackend.onrender.com";
}

const ADMIN_TOKEN_KEY = "adminToken";

// --- Safe JSON helper (prevents res.json() crashes) ---
async function safeJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    // If server sends HTML or plain text, keep it here
    return { message: text };
  }
}

// ✅ PH time (Asia/Manila)
function getPHTimeParts() {
  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minutePart = parts.find((p) => p.type === "minute")?.value ?? "0";

  return {
    hour: Number(hourPart),
    minute: Number(minutePart),
  };
}

// ✅ Active 08:00–20:59, Inactive 21:00–07:59
function computeDesiredStatusPH() {
  const { hour } = getPHTimeParts();
  return hour >= 21 || hour < 8 ? "inactive" : "active";
}

async function getServiceStatus() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);

  // If your backend requires auth even for GET, this fixes it.
  const res = await fetch(`${getApiBase()}/admin/service-status`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || "Failed to load service status");
  return data.status;
}

async function patchServiceStatus(status) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return null; // no admin token -> don't PATCH

  const res = await fetch(`${getApiBase()}/admin/service-status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || "Failed to update service status");
  return data.status;
}

function applyServiceStatusUI(status) {
  const statusText = document.querySelector(".status-text");
  const statusBox = document.querySelector(".status-box");
  if (!statusText || !statusBox) return;

  if (status === "active") {
    statusText.textContent = "Service Active";
    statusBox.style.border = "3px solid #00FF04";
  } else {
    statusText.textContent = "Service Inactive";
    statusBox.style.border = "3px solid red";
  }
}

async function loadServiceStatus() {
  try {
    const status = await getServiceStatus();
    applyServiceStatusUI(status);
  } catch (e) {
    console.error(e.message);
    applyServiceStatusUI("inactive");
  }
}

window.loadServiceStatus = loadServiceStatus;

// ✅ AUTO scheduler
let lastAutoApplied = null;

async function enforceAutoSchedule() {
  try {
    const desired = computeDesiredStatusPH();
    if (desired === lastAutoApplied) return;

    const current = await getServiceStatus();
    applyServiceStatusUI(current);

    if (current !== desired) {
      const updated = await patchServiceStatus(desired);
      if (updated) {
        lastAutoApplied = updated;
        applyServiceStatusUI(updated);
      } else {
        // no token -> can't patch; avoid spamming
        lastAutoApplied = desired;
      }
    } else {
      lastAutoApplied = current;
    }
  } catch (e) {
    console.error("Auto schedule error:", e.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadServiceStatus();
  enforceAutoSchedule();
  setInterval(enforceAutoSchedule, 30 * 1000);
});
