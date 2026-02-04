const API_BASE = "https://miyummybackend.onrender.com";
window.API_BASE = API_BASE;

const ADMIN_TOKEN_KEY = "adminToken";

function requireAdminLogin() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    window.location.href = "login.html";
    // throw new Error("Not logged in");
  }
  return token;
}

async function apiFetch(path, options = {}) {
  const token = requireAdminLogin();

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

let salesChartInstance = null;

// ✅ AUTO REFRESH SETTINGS
const REFRESH_INTERVAL = 5000; // 5 seconds
let lastOrdersSignature = "";

/* ------------------------------
   SERVICE STATUS (SERVER-BASED)
--------------------------------*/

async function getServiceStatus() {
  const data = await apiFetch(`/admin/service-status`);
  return data.status; // "active" | "inactive"
}

async function setServiceStatus(status) {
  const data = await apiFetch(`/admin/service-status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return data.status;
}

// click handler for the green/red service box
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

function formatDayTime(ms) {
  return new Date(ms).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getTodayRangeMs() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

function updateDayRangeLabel() {
  const label = document.getElementById("dayRangeLabel");
  if (!label) return;

  const { start, end } = getTodayRangeMs();
  label.textContent = `${formatDayTime(start)} to ${formatDayTime(end)} (resets at 24:00)`;
}

// ✅ prevent refresh while admin is typing
function isAdminInteracting() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "select" || tag === "textarea";
}

// ✅ signature to detect real changes (address, status, rider)
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

/* ------------------------------
   SALES (GRAPH)
--------------------------------*/

async function fetchFlavorSales() {
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
  if (totalSalesDisplay) totalSalesDisplay.textContent = `Total Sales: ${money(totalAll)}`;

  if (salesChartInstance) {
    salesChartInstance.destroy();
    salesChartInstance = null;
  }

  salesChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "16oz", data: sales16, backgroundColor: "#94bbb4" },
        { label: "12oz", data: sales12, backgroundColor: "#6c9b92" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: false },
        y: { stacked: false, beginAtZero: true },
      },
    },
  });
}

/* ------------------------------
   ORDERS (MANAGEMENT)
--------------------------------*/

async function fetchOrders() {
  return await apiFetch(`/admin/orders`);
}

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
    const dropId = `drop_${idx}`;
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
    drop.id = dropId;
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
          <div class="info-line">Date Ordered: ${formatDateTime(o.orderDate)}</div>
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
        await renderSalesChart();
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

/* ------------------------------
   AUTO REFRESH LOOP
--------------------------------*/

document.addEventListener("DOMContentLoaded", async () => {
  try {
    requireAdminLogin();

    updateDayRangeLabel();

    if (window.loadServiceStatus) await window.loadServiceStatus();

    await renderSalesChart();
    await renderOrders(true);

    setInterval(async () => {
      if (isAdminInteracting()) return;
      updateDayRangeLabel();
      await renderOrders();
    }, REFRESH_INTERVAL);
  } catch (e) {
    alert(e.message);
  }
});
