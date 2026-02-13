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

const REFRESH_INTERVAL = 5000;
let lastOrdersSignature = "";
let lastSalesSignature = "";

// "monthly" | "weekly" | "daily"
let currentView = "monthly";

/* =========================
   SERVICE STATUS
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

function pesoCompact(value) {
  return Number(value || 0).toLocaleString("en-PH");
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
        o.orderDate || "",
        o.createdAt || "",
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

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* =========================
   RANGE + LABEL
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

/* =========================
   ORDERS FETCH + TIMESTAMP
========================= */
async function fetchOrders() {
  return await apiFetch(`/admin/orders`);
}

function pickOrderTimestamp(o) {
  const t = o?.orderDate ?? o?.createdAt;
  const ms = typeof t === "number" ? t : Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

/* =========================
   MONTHLY COMPUTE (cumulative)
========================= */
function computeMonthly(orders) {
  const { now } = getYearToDateRange();
  const year = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  const labels = [];
  const monthKeys = [];
  for (let m = 0; m <= currentMonthIndex; m++) {
    const d = new Date(year, m, 1);
    labels.push(d.toLocaleString("en-PH", { month: "short" }));
    monthKeys.push(`${year}-${String(m + 1).padStart(2, "0")}`);
  }

  const totalsByMonth = Object.fromEntries(monthKeys.map((k) => [k, 0]));

  orders.forEach((o) => {
    const status = String(o.status || "").trim();
    if (status !== "Delivered") return;

    const ms = pickOrderTimestamp(o);
    if (!ms) return;

    const d = new Date(ms);
    if (d.getFullYear() !== year) return;

    const key = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!(key in totalsByMonth)) return;

    totalsByMonth[key] += Number(o.total || 0);
  });

  const monthlyTotals = monthKeys.map((k) => Number(totalsByMonth[k] || 0));

  let running = 0;
  const cumulative = monthlyTotals.map((v) => {
    running += v;
    return running;
  });

  return { labels, series: cumulative, grandTotal: running, tooltipRanges: null };
}

/* =========================
   WEEKLY COMPUTE (cumulative)
========================= */
function fmtShort(d) {
  return d.toLocaleDateString("en-PH", { month: "short", day: "2-digit" });
}

function computeWeekly(orders) {
  const { start, now } = getYearToDateRange();
  const year = now.getFullYear();

  const startMs = start.getTime();
  const nowMs = now.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const weeksCount = Math.max(1, Math.ceil((nowMs - startMs + 1) / weekMs));

  const weeklyTotals = new Array(weeksCount).fill(0);
  const labels = [];
  const tooltipRanges = [];

  for (let i = 0; i < weeksCount; i++) {
    const wStart = new Date(startMs + i * weekMs);
    const wEnd = new Date(Math.min(startMs + (i + 1) * weekMs - 1, nowMs));

    labels.push(fmtShort(wStart));
    tooltipRanges.push(`${fmtShort(wStart)} – ${fmtShort(wEnd)}`);
  }

  orders.forEach((o) => {
    const status = String(o.status || "").trim();
    if (status !== "Delivered") return;

    const ms = pickOrderTimestamp(o);
    if (!ms) return;

    const d = new Date(ms);
    if (d.getFullYear() !== year) return;
    if (ms < startMs || ms > nowMs) return;

    const idx = Math.floor((ms - startMs) / weekMs);
    if (idx < 0 || idx >= weeklyTotals.length) return;

    weeklyTotals[idx] += Number(o.total || 0);
  });

  let running = 0;
  const cumulative = weeklyTotals.map((v) => {
    running += v;
    return running;
  });

  return { labels, series: cumulative, grandTotal: running, tooltipRanges };
}

/* =========================
   DAILY COMPUTE (cumulative)
========================= */
function computeDaily(orders) {
  const { start, now } = getYearToDateRange();
  const year = now.getFullYear();

  const startMs = start.getTime();
  const nowMs = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const daysCount = Math.floor((nowMs - startMs) / dayMs) + 1;

  const dailyTotals = new Array(daysCount).fill(0);
  const labels = [];

  for (let i = 0; i < daysCount; i++) {
    const d = new Date(startMs + i * dayMs);
    labels.push(
      d.toLocaleDateString("en-PH", {
        month: "short",
        day: "2-digit",
      })
    );
  }

  orders.forEach((o) => {
    const status = String(o.status || "").trim();
    if (status !== "Delivered") return;

    const ms = pickOrderTimestamp(o);
    if (!ms) return;

    const d = new Date(ms);
    if (d.getFullYear() !== year) return;
    if (ms < startMs || ms > nowMs) return;

    const idx = Math.floor((ms - startMs) / dayMs);
    if (idx < 0 || idx >= dailyTotals.length) return;

    dailyTotals[idx] += Number(o.total || 0);
  });

  let running = 0;
  const cumulative = dailyTotals.map((v) => {
    running += v;
    return running;
  });

  return { labels, series: cumulative, grandTotal: running, tooltipRanges: null };
}

/* =========================
   BUTTON UI
========================= */
function setActiveButton(view) {
  const btnMonthly = document.getElementById("btnMonthly");
  const btnWeekly = document.getElementById("btnWeekly");
  const btnDaily = document.getElementById("btnDaily");
  const title = document.getElementById("salesTitle");

  if (title) {
    if (view === "weekly") title.textContent = "Sales Overview (Weekly YTD)";
    else if (view === "daily") title.textContent = "Sales Overview (Daily YTD)";
    else title.textContent = "Sales Overview (Monthly YTD)";
  }

  const reset = (btn) => {
    if (!btn) return;
    btn.style.background = "white";
    btn.style.color = "#1f2b2a";
  };

  reset(btnMonthly);
  reset(btnWeekly);
  reset(btnDaily);

  const active =
    view === "weekly" ? btnWeekly :
    view === "daily" ? btnDaily :
    btnMonthly;

  if (active) {
    active.style.background = "#94bbb4";
    active.style.color = "white";
  }
}

/* =========================
   CHART RENDER (AREA)
   - Legend removed
========================= */
async function renderSalesAreaChart(force = false) {
  const canvas = document.getElementById("salesChart");
  if (!canvas) return;

  const totalSalesDisplay = document.getElementById("totalSalesDisplay");

  const orders = await fetchOrders();
  const signature = buildOrdersSignature(orders);

  if (!force && signature === lastSalesSignature) return;
  lastSalesSignature = signature;

  let computed;
  if (currentView === "weekly") computed = computeWeekly(orders);
  else if (currentView === "daily") computed = computeDaily(orders);
  else computed = computeMonthly(orders);

  if (totalSalesDisplay) {
    totalSalesDisplay.textContent = `Total Sales (YTD): ${money(computed.grandTotal)}`;
  }

  if (salesChartInstance) {
    salesChartInstance.destroy();
    salesChartInstance = null;
  }

  const lineColor = "#94bbb4";
  const fillColor = hexToRgba("#D9EEEA", 0.85);

  const manyPoints = computed.labels.length > 70;
  const pointRadius =
    currentView === "weekly" ? 2 :
    currentView === "daily" ? (manyPoints ? 0 : 2) :
    4;

  salesChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: computed.labels,
      datasets: [
        {
          label: "Cumulative YTD",
          data: computed.series,
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.35,
          pointRadius,
          pointHoverRadius: pointRadius === 0 ? 3 : 6,
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
        // ✅ remove legend
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const i = items?.[0]?.dataIndex ?? 0;
              if (computed.tooltipRanges && computed.tooltipRanges[i]) {
                return computed.tooltipRanges[i]; // weekly range
              }
              return items?.[0]?.label || ""; // month/day label
            },
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
        x: {
          ticks: {
            // keep daily readable
            maxRotation: currentView === "daily" ? 0 : 0,
            autoSkip: currentView === "daily",
            maxTicksLimit: currentView === "daily" ? 10 : 12,
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

        // Delivered changes sales => refresh chart
        await renderSalesAreaChart(true);
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

    const btnMonthly = document.getElementById("btnMonthly");
    const btnWeekly = document.getElementById("btnWeekly");
    const btnDaily = document.getElementById("btnDaily");

    setActiveButton(currentView);

    if (btnMonthly) {
      btnMonthly.addEventListener("click", async () => {
        currentView = "monthly";
        setActiveButton(currentView);
        await renderSalesAreaChart(true);
      });
    }

    if (btnWeekly) {
      btnWeekly.addEventListener("click", async () => {
        currentView = "weekly";
        setActiveButton(currentView);
        await renderSalesAreaChart(true);
      });
    }

    if (btnDaily) {
      btnDaily.addEventListener("click", async () => {
        currentView = "daily";
        setActiveButton(currentView);
        await renderSalesAreaChart(true);
      });
    }

    if (window.loadServiceStatus) await window.loadServiceStatus();

    await renderSalesAreaChart(true);
    await renderOrders(true);

    setInterval(async () => {
      if (isAdminInteracting()) return;
      updateYearToDateLabel();
      await renderOrders();
      await renderSalesAreaChart(); // signature-protected
    }, REFRESH_INTERVAL);
  } catch (e) {
    alert(e.message);
  }
});
