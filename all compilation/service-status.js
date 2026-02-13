function getApiBase() {
  return window.API_BASE || "https://miyummybackend.onrender.com";
}

const ADMIN_TOKEN_KEY = "adminToken";

function getPHTimeParts() {
  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const map = {};
  for (const p of parts) map[p.type] = p.value;

  return {
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
  };
}

function computeDesiredStatusPH() {
  const { hour, minute } = getPHTimeParts();

  if (hour >= 21 || hour < 8) return "inactive";

  return "active";
}

async function getServiceStatus() {
  const res = await fetch(`${getApiBase()}/admin/service-status`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to load service status");
  return data.status;
}

async function patchServiceStatus(status) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    return null;
  }

  const res = await fetch(`${getApiBase()}/admin/service-status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  const data = await res.json().catch(() => ({}));
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
