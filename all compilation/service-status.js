function getApiBase() {
  return window.API_BASE || "https://miyummybackend.onrender.com";
}

async function getServiceStatus() {
  const res = await fetch(`${getApiBase()}/admin/service-status`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to load service status");
  return data.status;
}

async function setServiceStatus(status) {
  await fetch(`${getApiBase()}/admin/service-status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status })
  });
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

async function autoControlServiceStatus() {
  const now = new Date();
  const hour = now.getHours(); // 0–23

  // Open from 9:00 AM (9) until 8:59 PM (20)
  const shouldBeActive = hour >= 9 && hour < 21;

  try {
    const currentStatus = await getServiceStatus();

    if (shouldBeActive && currentStatus !== "active") {
      await setServiceStatus("active");
      applyServiceStatusUI("active");
    }

    if (!shouldBeActive && currentStatus !== "inactive") {
      await setServiceStatus("inactive");
      applyServiceStatusUI("inactive");
    }

    if (currentStatus === "active" || currentStatus === "inactive") {
      applyServiceStatusUI(currentStatus);
    }

  } catch (e) {
    console.error(e.message);
    applyServiceStatusUI("inactive");
  }
}

function loadServiceStatus() {
  autoControlServiceStatus();
}

window.loadServiceStatus = loadServiceStatus;

document.addEventListener("DOMContentLoaded", () => {
  autoControlServiceStatus();

  // Check every 60 seconds
  setInterval(autoControlServiceStatus, 60000);
});
