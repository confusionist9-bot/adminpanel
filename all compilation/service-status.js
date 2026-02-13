
function getApiBase() {
  return window.API_BASE || "https://miyummybackend.onrender.com";
}

async function getServiceStatus() {
  const res = await fetch(`${getApiBase()}/admin/service-status`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to load service status");
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

document.addEventListener("DOMContentLoaded", () => {
  loadServiceStatus();
});
