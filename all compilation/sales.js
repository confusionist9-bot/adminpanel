const API_BASE = "https://miyummybackend.onrender.com";
window.API_BASE = API_BASE;

const ADMIN_TOKEN_KEY = "adminToken";

function goToLogin() {
  window.location.href = "/";
}

function requireAdminLogin() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    goToLogin();
    return null;
  }
  return token;
}

function adminLogout() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  goToLogin();
}
window.adminLogout = adminLogout;

async function apiFetch(path, options = {}) {
  const token = requireAdminLogin();
  if (!token) throw new Error("Not logged in");

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const raw = await res.text();
  let data = {};
  try { data = JSON.parse(raw); } catch {}

  if (!res.ok) throw new Error(data.message || raw || `Request failed (${res.status})`);
  return data;
}

let salesChartInstance = null;

/* ===========================
   YEAR TO DATE RANGE
=========================== */

function getYearToDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  return {
    start: start.getTime(),
    end: now.getTime()
  };
}

function updateYearRangeLabel() {
  const label = document.getElementById("dayRangeLabel");
  if (!label) return;

  const { start, end } = getYearToDateRange();

  const startStr = new Date(start).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const endStr = new Date(end).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  label.textContent = `${startStr} to ${endStr} (Year to Date)`;
}

/* ===========================
   SALES CHART
=========================== */

function money(n) {
  return `₱${Number(n || 0).toFixed(2)}`;
}

async function fetchFlavorSales() {
  // backend already returns all data
  return await apiFetch(`/admin/sales/flavors`);
}

async function renderSalesChart() {
  const canvas = document.getElementById("salesChart");
  if (!canvas) return;

  const totalSalesDisplay = document.getElementById("totalSalesDisplay");
  const rows = await fetchFlavorSales();

  const labels = rows.map((r) => r.flavor);
  const sales16 = rows.map((r) => Number(r.sales16oz || 0));
  const sales12 = rows.map((r) => Number(r.sales12oz || 0));

  const totalAll = [...sales16, ...sales12].reduce((a, b) => a + b, 0);
  if (totalSalesDisplay) {
    totalSalesDisplay.textContent = `Total Sales (YTD): ${money(totalAll)}`;
  }

  if (salesChartInstance) {
    salesChartInstance.destroy();
    salesChartInstance = null;
  }

  salesChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "16oz",
          data: sales16,
          backgroundColor: "#D9EEEA"
        },
        {
          label: "12oz",
          data: sales12,
          backgroundColor: "#94bbb4"
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: false },
        y: { beginAtZero: true }
      },
    },
  });
}

/* ===========================
   INIT
=========================== */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    requireAdminLogin();
    updateYearRangeLabel();
    await renderSalesChart();
  } catch (e) {
    alert(e.message);
  }
});
