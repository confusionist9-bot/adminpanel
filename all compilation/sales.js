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
  try {
    data = JSON.parse(raw);
  } catch {}

  if (!res.ok) throw new Error(data.message || raw || `Request failed (${res.status})`);
  return data;
}

let salesChartInstance = null;

const REFRESH_INTERVAL = 5000;
let lastOrdersSignature = "";

/* =========================
   SERVICE STATUS (same)
========================= */
async function getServiceStatus() {
  const data = await apiFetch(`/admin/service-status`);
  return data.status;
}

async function setServiceStatus(status) {
  const data = await apiFetch(`/admin/service-status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return data.status;
}

document.addEventListener("DOMContentLoaded", function () {
  requireAdminLogin();

  const statusBox = document.querySelector(".status-box");
  if (!statusBox) return;

  statusBox.addEventListener("click", async function () {
    try {
      const currentStatus = await getServiceStatus();

      if (currentStatus === "active") {
        const confirmOff = confirm(
          "Are you sure you want to set the service to INACTIVE?\n\nCustomers will not be able to place orders."
        );
        if (!confirmOff) return;
        await setServiceStatus("inactive");
      } else {
        const confirmOn = confirm(
          "Are you sure you want to set the service to ACTIVE?\n\nCustomers will be able to place orders."
        );
        if (!confirmOn) return;
        await setServiceStatus("active");
      }

      if (window.loadServiceStatus) await window.loadServiceStatus();
    } catch (e) {
      alert(e.message);
    }
  });
});

/* =========================
   HELPERS
========================= */
function money(n) {
  return `₱${Number(n || 0).toFixed(2)}`;
}

function formatDateTime(ms) {
  if (!ms) return "N/A";
  return new Date(ms).toLocaleString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusOptions(current) {
  const statuses = ["Processing", "Preparing", "Out for Delivery", "Delivered"];
  return statuses
    .map((s) => `<option ${s === current ? "selected" : ""}>${s}</option>`)
    .join("");
}

function itemsToText(items) {
  if (!Array.isArray(items) || items.length === 0) return "No items";
  return items
    .map(
      (i) =>
        `Flavor: ${i.productName} (${i.size}) x${i.quantity}${
          i.addons ? ` | Add ons: ${i.addons}` : ""
        }`
    )
    .join("<br>");
}

function isAdminInteracting() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "select" || tag === "textarea";
}

function buildOrdersSignature(orders) {
  return orders
    .map((o) =>
      [
        o._id,
        o.status,
        o.total,
        o.deliveryAddressSnapshot?.fullname || "",
        o.deliveryAddressSnapshot?.number || "",
        o.deliveryAddressSnapshot?.barangay || "",
        o.deliveryAddressSnapshot?.landmark || "",
        o.rider?.name || "",
        o.rider?.contact || "",
      ].join("|")
    )
    .join("||");
}

/* =========================
   MONTHLY YTD (Jan → Now)
   - No flavors
   - Delivered only counts as Sales
   - Area chart of CUMULATIVE YTD
========================= */
function getYearToDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  return { start, now };
}

function updateYearToDateLabel() {
  const label = document.getElementById("dayRangeLabel");
  if (!label) return;

  const { start, now } = getYearToDateRange();

  const startStr = start.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const nowStr = now.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  label.textContent = `${startStr} to ${nowStr} (Year to Date)`;
}

function monthLabel(dateObj) {
  return dateObj.toLocaleString("en-PH", { month: "short" }); // Jan, Feb...
}

function buildMonthBucketsForYearToDate() {
  const { now } = getYearToDateRange();
  const year = now.getFullYear();
  const currentMonthIndex = now.getMonth(); // 0..11

  const labels = [];
  const monthKeys = [];

  for (let m = 0; m <= currentMonthIndex; m++) {
    const d = new Date(year, m, 1);
    labels.push(monthLabel(d));
    monthKeys.push(`${year}-${String(m + 1).padStart(2, "0")}`);
  }

  return { labels, monthKeys, year };
}

async function fetchOrders() {
  return await apiFetch(`/admin/orders`);
}

function pickOrderTimestamp(o) {
  const t = o?.orderDate ?? o?.createdAt;
  const ms = typeof t === "number" ? t : Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

function computeMonthlySalesFromOrders(orders) {
  const { labels, monthKeys, year } = buildMonthBucketsForYearToDate();
  const totalsByMonth = Object.fromEntries(monthKeys.map((k) => [k, 0]));

  orders.forEach((o) => {
    const status = String(o.status || "").trim();
    if (status === "Cancelled") return;

    // ✅ count only Delivered as real sales
    if (status !== "Delivered") return;

    const ms = pickOrderTimestamp(o);
    if (!ms) return;

    const d = new Date(ms);
    if (d.getFullYear() !== year) return;

    const key = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!(key in totalsByMonth)) return;

    totalsByMonth[key] += Number(o.total || 0);
  });

  const monthlySeries = monthKeys.map((k) => Number(totalsByMonth[k] || 0));

  // Build cumulative YTD series for Area chart
  let running = 0;
  const cumulativeSeries = monthlySeries.map((v) => {
    running += v;
    return running;
  });

  const grandTotal = running;

  return { labels, monthlySeries, cumulativeSeries, grandTotal };
}

function pesoCompact(value) {
  const n = Number(value || 0);
  // 12000 -> 12,000 (simple)
  return n.toLocaleString("en-PH");
}

function hexToRgba(hex, alpha) {
  // supports #RRGGBB
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function renderSalesAreaChartMonthlyYTD() {
  const canvas = document.getElementById("salesChart");
  if (!canvas) return;

  const totalSalesDisplay = document.getElementById("totalSalesDisplay");
  const orders = await fetchOrders();

  const { labels, cumulativeSeries, grandTotal } = computeMonthlySalesFromOrders(orders);

  if (totalSalesDisplay) {
    totalSalesDisplay.textContent = `Total Sales (YTD): ${money(grandTotal)}`;
  }

  if (salesChartInstance) {
    salesChartInstance.destroy();
    salesChartInstance = null;
  }

  // Keep your color theme
  const lineColor = "#94bbb4";
  const fillColor = hexToRgba("#D9EEEA", 0.85); // soft fill, still your color

  salesChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Cumulative YTD",
          data: cumulativeSeries,
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.35, // smooth curve
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: lineColor,
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { boxWidth: 14, boxHeight: 14 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ₱${pesoCompact(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => `₱${pesoCompact(val)}`,
          },
        },
      },
    },
  });
}

/* =========================
   ORDERS MANAGEMENT (same)
========================= */
async function updateOrderStatus(orderId, status) {
  return await apiFetch(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

async function assignRider(orderId, name, contact) {
  return await apiFetch(`/admin/orders/${orderId}/rider`, {
    method: "PATCH",
    body: JSON.stringify({ name, contact }),
  });
}

async function renderOrders(force = false) {
  let orders = await fetchOrders();
  orders = orders.filter((o) => String(o.status || "").trim() !== "Cancelled");

  const signature = buildOrdersSignature(orders);
  if (!force && signature === lastOrdersSignature) return;
  lastOrdersSignature = signature;

  const table = document.getElementById("ordersTable");
  if (!table) return;

  table.querySelectorAll(".table-row, .dropdown-content").forEach((e) => e.remove());

  orders.forEach((o, idx) => {
    const statusId = `status_${idx}`;
    const riderNameId = `riderName_${idx}`;
    const riderContactId = `riderContact_${idx}`;
    const applyBtnId = `apply_${idx}`;

    const row = document.createElement("div");
    row.className = "table-row";
    row.innerHTML = `
      <div>${o.username || "Unknown"}</div>
      <div>${o.orderNumber || "N/A"}</div>
      <div>${money(o.total)}</div>
      <div>
        <select id="${statusId}">
          ${statusOptions(o.status)}
        </select>
      </div>
    `;

    const drop = document.createElement("div");
    drop.className = "dropdown-content";
    drop.style.display = "none";

    const addr = o.deliveryAddressSnapshot || {};
    const rider = o.rider || {};

    drop.innerHTML = `
      <div class="dropdown-grid">
        <div class="box">
          <div class="box-title">Orders</div>
          <div class="info-line">${itemsToText(o.items)}</div>
        </div>

        <div class="box">
          <div class="box-title">Delivery information</div>
          <div class="info-line">Name: ${addr.fullname || "N/A"} (${addr.number || "N/A"})</div>
          <div class="info-line">Address: ${addr.barangay || "N/A"}</div>
          <div class="info-line">Landmark: ${addr.landmark || "N/A"}</div>
          <div class="info-line">Payment: ${o.paymentMethod || "N/A"}</div>
          <div class="info-line">Date Ordered: ${formatDateTime(pickOrderTimestamp(o))}</div>
        </div>

        <div class="box">
          <div class="box-title">Delivery rider</div>
          <input id="${riderNameId}" placeholder="Name" value="${rider.name || ""}" />
          <input id="${riderContactId}" placeholder="Contact number" value="${rider.contact || ""}" />
          <button class="apply-btn" id="${applyBtnId}">Apply</button>
        </div>
      </div>
    `;

    row.addEventListener("click", () => {
      drop.style.display = drop.style.display === "grid" ? "none" : "grid";
    });

    table.appendChild(row);
    table.appendChild(drop);

    const statusEl = document.getElementById(statusId);
    const riderNameEl = document.getElementById(riderNameId);
    const riderContactEl = document.getElementById(riderContactId);
    const applyBtn = document.getElementById(applyBtnId);

    [statusEl, riderNameEl, riderContactEl, applyBtn].forEach((el) => {
      el.addEventListener("click", (e) => e.stopPropagation());
    });

    statusEl.addEventListener("change", async () => {
      try {
        await updateOrderStatus(o._id, statusEl.value);
        o.status = statusEl.value;

        // ✅ refresh chart because Delivered affects sales
        await renderSalesAreaChartMonthlyYTD();
        await renderOrders(true);
      } catch (e) {
        alert(e.message);
        statusEl.value = o.status;
      }
    });

    applyBtn.addEventListener("click", async () => {
      try {
        await assignRider(o._id, riderNameEl.value, riderContactEl.value);
        await renderOrders(true);
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    requireAdminLogin();

    updateYearToDateLabel();

    if (window.loadServiceStatus) await window.loadServiceStatus();

    await renderSalesAreaChartMonthlyYTD();
    await renderOrders(true);

    setInterval(async () => {
      if (isAdminInteracting()) return;
      updateYearToDateLabel();
      await renderOrders();
    }, REFRESH_INTERVAL);
  } catch (e) {
    alert(e.message);
  }
});
