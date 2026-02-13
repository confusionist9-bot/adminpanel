const API_BASE = "https://miyummybackend.onrender.com";
const ADMIN_TOKEN_KEY = "adminToken";

/* ============================= */
/* AUTH CHECK */
/* ============================= */
function requireAdminLogin() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    window.location.href = "login.html";
    throw new Error("Not logged in");
  }
  return token;
}

/* ============================= */
/* FETCH WRAPPER */
/* ============================= */
async function apiFetch(path, options = {}) {
  const token = requireAdminLogin();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    console.error("❌ Failed:", res.status, body);

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.location.href = "login.html";
      return null;
    }

    alert(`Failed (${res.status})\n${body?.message || body || ""}`);
    return null;
  }

  return body;
}

/* ============================= */
/* LOAD USERS */
/* ============================= */
async function loadUsers() {
  const users = await apiFetch("/admin/users");
  if (!users) return;
  renderUsers(Array.isArray(users) ? users : []);
}

/* ============================= */
/* RENDER USERS */
/* ============================= */
function renderUsers(users) {
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = "";

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="5">No users found.</td></tr>`;
    return;
  }

  users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(u.firstName || "")} ${escapeHtml(u.lastName || "")}</td>
      <td>
        <a href="mailto:${escapeHtml(u.email || "")}">
          ${escapeHtml(u.email || "")}
        </a>
      </td>
      <td>${escapeHtml(u.username || "")}</td>
      <td>${escapeHtml(u.mobile || "")}</td>
      <td>
        <button class="delete-btn" onclick="deleteUser('${u._id}')">
          Delete
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ============================= */
/* DELETE USER */
/* ============================= */
async function deleteUser(id) {
  const confirmDelete = confirm("Are you sure you want to delete this user?");
  if (!confirmDelete) return;

  const result = await apiFetch(`/admin/users/${id}`, {
    method: "DELETE",
  });

  if (!result) return;

  alert("User deleted successfully!");
  loadUsers(); // refresh table
}

/* ============================= */
/* SEARCH */
/* ============================= */
document.getElementById("searchInput").addEventListener("input", function () {
  const value = this.value.toLowerCase();

  document.querySelectorAll("#usersTableBody tr").forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(value)
      ? ""
      : "none";
  });
});

/* ============================= */
/* HELPER */
/* ============================= */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m])
  );
}

/* ============================= */
/* INIT */
/* ============================= */
requireAdminLogin();
loadUsers();
