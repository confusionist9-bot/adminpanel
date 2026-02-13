const API_BASE = "https://miyummybackend.onrender.com";
const ADMIN_TOKEN_KEY = "adminToken";

function requireAdminLogin() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    window.location.href = "login.html";
    throw new Error("Admin token missing");
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

  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    // ignore
  }

  if (!res.ok) {
    alert((body && body.message) ? body.message : `Request failed (${res.status})`);
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
      <td>${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</td>
      <td><a href="mailto:${escapeHtml(u.email)}">${escapeHtml(u.email)}</a></td>
      <td>${escapeHtml(u.username)}</td>
      <td>${escapeHtml(u.mobile)}</td>
      <td>
        <button class="${btnClass}" onclick="toggleBan('${u._id}', ${isBanned})">
          ${btnLabel}
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

let USERS_CACHE = [];

async function loadUsers() {
  const users = await apiFetch("/admin/users", { method: "GET" });
  if (!users) return;

  USERS_CACHE = users;
  renderUsers(USERS_CACHE);
}

async function toggleBan(userId, currentlyBanned) {
  const actionText = currentlyBanned ? "unban" : "ban";
  const ok = confirm(`Are you sure you want to ${actionText} this user?`);
  if (!ok) return;

  const result = await apiFetch(`/admin/users/${userId}/ban`, {
    method: "PATCH"
  });

  if (!result) return;
  await loadUsers();
}

document.addEventListener("DOMContentLoaded", () => {
  requireAdminLogin();

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => renderUsers(USERS_CACHE));
  }

  loadUsers();
});
