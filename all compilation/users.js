const API_BASE = "https://miyummybackend.onrender.com";
const ADMIN_TOKEN_KEY = "adminToken";

function normalizeToken(raw) {
  if (!raw) return null;

  let t = String(raw).trim();

  // if token got saved like JSON string: "\"eyJ...\""
  try {
    const parsed = JSON.parse(t);
    if (typeof parsed === "string") t = parsed.trim();
  } catch (_) {}

  // if token got saved with Bearer already
  if (t.toLowerCase().startsWith("bearer ")) {
    t = t.slice(7).trim();
  }

  // basic sanity (jwt has 2 dots)
  if ((t.match(/\./g) || []).length < 2) return null;

  return t;
}

function requireAdminLogin() {
  const raw = localStorage.getItem(ADMIN_TOKEN_KEY);
  const token = normalizeToken(raw);

  if (!token) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.location.href = "login.html";
    throw new Error("Admin token missing/invalid");
  }
  return token;
}

async function apiFetch(path, options = {}) {
  const token = requireAdminLogin();

  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    console.error("❌ Failed:", res.status, body);

    // if token invalid/expired/admin only -> force relogin
    if (res.status === 401 || res.status === 403) {
      alert(body?.message || body || "Session expired. Please login again.");
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.location.href = "login.html";
      return null;
    }

    alert(`Failed (${res.status})\n${body?.message || body || ""}`);
    return null;
  }

  return body;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function matchesSearch(u, q) {
  const text = `${u.firstName} ${u.lastName} ${u.email} ${u.username} ${u.mobile}`.toLowerCase();
  return text.includes(q);
}

let USERS_CACHE = [];

function renderUsers(users) {
  const tbody = document.getElementById("usersTableBody");
  const searchInput = document.getElementById("searchInput");
  const q = (searchInput?.value || "").trim().toLowerCase();

  const filtered = q ? users.filter(u => matchesSearch(u, q)) : users;

  tbody.innerHTML = "";

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5">No users found.</td></tr>`;
    return;
  }

  filtered.forEach((u) => {
    const isBanned = !!u.isBanned;

    const btnLabel = isBanned ? "Unban" : "Ban";
    const btnClass = isBanned ? "unban-btn" : "ban-btn";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(u.firstName || "")} ${escapeHtml(u.lastName || "")}</td>
      <td><a href="mailto:${escapeHtml(u.email || "")}">${escapeHtml(u.email || "")}</a></td>
      <td>${escapeHtml(u.username || "")}</td>
      <td>${escapeHtml(u.mobile || "")}</td>
      <td>
        <button class="${btnClass}" onclick="toggleBan('${u._id}', ${isBanned})">
          ${btnLabel}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadUsers() {
  const users = await apiFetch("/admin/users", { method: "GET" });
  if (!users) return;

  USERS_CACHE = Array.isArray(users) ? users : [];
  renderUsers(USERS_CACHE);
}

async function toggleBan(userId, currentlyBanned) {
  const actionText = currentlyBanned ? "unban" : "ban";
  const ok = confirm(`Are you sure you want to ${actionText} this user?`);
  if (!ok) return;

  const result = await apiFetch(`/admin/users/${userId}/ban`, { method: "PATCH" });
  if (!result) return;

  loadUsers();
}

document.addEventListener("DOMContentLoaded", () => {
  requireAdminLogin();

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => renderUsers(USERS_CACHE));
  }

  loadUsers();
});
