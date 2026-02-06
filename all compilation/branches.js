document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://miyummybackend.onrender.com";
  const EDIT_ID_KEY = "editBranchId";

  const ADMIN_TOKEN_KEY = "adminToken";


  function requireAdminLogin() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      window.location.href = "login.html";
      throw new Error("Not logged in");
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

  function updateClock() {
    const el = document.getElementById("clock");
    if (!el) return;

    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    minutes = String(minutes).padStart(2, "0");

    el.textContent = `${hours}:${minutes} ${ampm}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  function timeToMinutes(time) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  function formatTime12(time24) {
    const [hh, mm] = time24.split(":").map(Number);
    const ampm = hh >= 12 ? "PM" : "AM";
    const hours12 = hh % 12 || 12;
    const minutes = String(mm).padStart(2, "0");
    return `${hours12}:${minutes} ${ampm}`;
  }

  function isValidHours(open, close) {
    return timeToMinutes(open) < timeToMinutes(close);
  }

  function showInvalidHoursMessage() {
    alert("Invalid operating hours.\n\nClosing time must be later than opening time.");
  }

  function showIncompleteFieldsMessage() {
    alert("Cannot save changes.\n\nPlease complete all fields correctly.");
  }

  async function apiGetBranches() {
    const res = await fetch(`${API_BASE}/branches`);
    if (!res.ok) throw new Error(`Failed to load branches (${res.status})`);
    return await res.json();
  }

  async function apiCreateBranch(payload) {
    return await apiFetch(`/admin/branches`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function apiUpdateBranch(branchId, payload) {
    return await apiFetch(`/admin/branches/${branchId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async function apiDeleteBranch(branchId) {
    return await apiFetch(`/admin/branches/${branchId}`, {
      method: "DELETE",
    });
  }

  async function renderBranches() {

    requireAdminLogin();

    const list = document.getElementById("branchesList");
    if (!list) return;

    list.innerHTML = `
      <div class="branch-card">
        <div class="branch-info">
          <h3>Loading...</h3>
        </div>
      </div>
    `;

    try {
      const branches = await apiGetBranches();
      const arr = Array.isArray(branches) ? branches : [];

      if (!arr.length) {
        list.innerHTML = `
          <div class="branch-card">
            <div class="branch-info">
              <h3>No branches available</h3>
            </div>
          </div>
        `;
        return;
      }

      list.innerHTML = arr
        .map((b) => {
          const id = b._id;
          const name = b.branchLocation || "Unnamed Branch";
          const address = b.branchDescription || "";
          const open = b.openTime || "09:00";
          const close = b.closeTime || "21:00";
          const isActive = b.isActive !== false;

          const statusLabel = isActive ? "Open" : "Closed";

          return `
            <div class="branch-card"
                 data-id="${id}"
                 data-open="${open}"
                 data-close="${close}"
                 data-active="${isActive ? "1" : "0"}">

              <button class="delete-btn" title="Delete branch">
                <svg viewBox="0 0 24 24" class="trash-icon">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M6 6l1 14h10l1-14" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>

              <div class="branch-info">
                <h3>${escapeHtml(name)}</h3>
                <p>${escapeHtml(address)}</p>
                <span>Operating Hours: ${formatTime12(open)} - ${formatTime12(close)}</span>
              </div>

              <div class="branch-actions">
                <button class="edit-btn">Edit</button>
                <button class="status-btn ${isActive ? "open" : "inactive"}">
                  ${statusLabel} <span class="dot"></span>
                </button>
              </div>
            </div>
          `;
        })
        .join("");
    } catch (e) {
      list.innerHTML = `
        <div class="branch-card">
          <div class="branch-info">
            <h3>${escapeHtml(e.message || "Failed to load branches")}</h3>
          </div>
        </div>
      `;
    }
  }

  document.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".edit-btn");
    if (editBtn) {
      const card = editBtn.closest(".branch-card");
      const id = card?.dataset.id;
      if (!id) return;

      localStorage.setItem(EDIT_ID_KEY, id);
      window.location.href = "edit-branch.html";
      return;
    }

    const deleteBtn = e.target.closest(".delete-btn");
    if (deleteBtn) {
      const card = deleteBtn.closest(".branch-card");
      const id = card?.dataset.id;
      if (!id) return;

      const name = card.querySelector(".branch-info h3")?.textContent || "this branch";
      if (!confirm(`Are you sure you want to delete ${name}?`)) return;

      try {
        await apiDeleteBranch(id);
        await renderBranches();
      } catch (err) {
        alert(err.message || "Failed to delete branch.");
      }
      return;
    }

    const statusBtn = e.target.closest(".status-btn");
    if (statusBtn) {
      const card = statusBtn.closest(".branch-card");
      const id = card?.dataset.id;
      if (!id) return;

      const currentActive = card.dataset.active === "1";
      const msg = currentActive
        ? "Set this branch to CLOSED?\n\nCustomers will see it as unavailable."
        : "Set this branch to ACTIVE?\n\nCustomers can use this branch again.";

      if (!confirm(msg)) return;

      try {
        await apiUpdateBranch(id, { isActive: !currentActive });
        await renderBranches();
      } catch (err) {
        alert(err.message || "Failed to update branch status.");
      }
      return;
    }
  });

  const saveBranchBtn = document.getElementById("saveBranch");
  if (saveBranchBtn) {
    requireAdminLogin();

    saveBranchBtn.addEventListener("click", async () => {
      const nameEl = document.getElementById("branchName");
      const addrEl = document.getElementById("branchAddress");
      const openEl = document.getElementById("openTime");
      const closeEl = document.getElementById("closeTime");

      const name = nameEl?.value.trim();
      const address = addrEl?.value.trim();
      const open = openEl?.value;
      const close = closeEl?.value;

      if (!name || !address || !open || !close) {
        alert("Cannot save branch.\n\nPlease complete all fields before saving.");
        return;
      }

      if (!isValidHours(open, close)) {
        showInvalidHoursMessage();
        return;
      }

      const ok = confirm("Confirm new branch.\n\nSave this branch?");
      if (!ok) return;

      try {
        await apiCreateBranch({
          branchLocation: name,
          branchDescription: address,
          openTime: open,
          closeTime: close,
          isActive: true,
        });

        window.location.href = "branches.html";
      } catch (err) {
        alert(err.message || "Failed to create branch.");
      }
    });
  }

  const saveChangesBtn = document.getElementById("saveChanges");
  if (saveChangesBtn) {
    requireAdminLogin();

    (async () => {
      const branchId = localStorage.getItem(EDIT_ID_KEY);

      if (!branchId) {
        alert("No branch selected to edit.");
        window.location.href = "branches.html";
        return;
      }

      let branch = null;
      try {
        const branches = await apiGetBranches();
        branch = (branches || []).find((b) => b._id === branchId);
      } catch {}

      if (!branch) {
        alert("Branch not found or failed to load.");
        window.location.href = "branches.html";
        return;
      }

      document.getElementById("branchName").value = branch.branchLocation || "";
      document.getElementById("branchAddress").value = branch.branchDescription || "";
      document.getElementById("openTime").value = branch.openTime || "09:00";
      document.getElementById("closeTime").value = branch.closeTime || "21:00";

      saveChangesBtn.addEventListener("click", async () => {
        const name = document.getElementById("branchName").value.trim();
        const address = document.getElementById("branchAddress").value.trim();
        const open = document.getElementById("openTime").value;
        const close = document.getElementById("closeTime").value;

        if (!name || !address || !open || !close) {
          showIncompleteFieldsMessage();
          return;
        }

        if (!isValidHours(open, close)) {
          showInvalidHoursMessage();
          return;
        }

        const confirmSave = confirm("Confirm changes.\n\nSave updates to this branch?");
        if (!confirmSave) return;

        try {
          await apiUpdateBranch(branchId, {
            branchLocation: name,
            branchDescription: address,
            openTime: open,
            closeTime: close,
          });

          localStorage.removeItem(EDIT_ID_KEY);
          window.location.href = "branches.html";
        } catch (err) {
          alert(err.message || "Failed to update branch.");
        }
      });
    })();
  }

  renderBranches();

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
