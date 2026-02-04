// edit-avocado.js
(function () {
  const API_BASE = "https://miyummybackend.onrender.com";
  const SLUG = "avocado";

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

  requireAdminLogin();

  function num(v, d = 0) {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : d;
  }

  function enforceNumeric(el) {
    if (!el) return;
    el.addEventListener("input", (e) => {
      let v = e.target.value.replace(/[^\d.]/g, "");
      const p = v.split(".");
      if (p.length > 2) v = p[0] + "." + p.slice(1).join("");
      if (p[1]) v = p[0] + "." + p[1].slice(0, 2);
      e.target.value = v;
    });
  }

  const price12 = document.getElementById("price12");
  const price16 = document.getElementById("price16");

  const pearlsToggle = document.getElementById("addonPearlsToggle");
  const pearlsPrice = document.getElementById("addonPearlsPrice");

  const grahamToggle = document.getElementById("addonGrahamToggle");
  const grahamPrice = document.getElementById("addonGrahamPrice");

  const pill = document.getElementById("productStatusPill");
  const saveBtn = document.getElementById("saveBtn");

  [price12, price16, pearlsPrice, grahamPrice].forEach(enforceNumeric);

  function setStatus(s) {
    pill.setAttribute("data-status", s);
    pill.querySelector(".pill-text").textContent = s === "available" ? "Available" : "Unavailable";
  }

  function getStatus() {
    const s = pill.getAttribute("data-status");
    return s === "unavailable" ? "unavailable" : "available";
  }

  function togglePrice(toggleEl, priceEl) {
    if (!toggleEl || !priceEl) return;
    if (toggleEl.checked) {
      priceEl.removeAttribute("disabled");
      priceEl.style.opacity = "1";
    } else {
      priceEl.setAttribute("disabled", "true");
      priceEl.style.opacity = "0.5";
    }
  }

  pill.addEventListener("click", () => {
    setStatus(getStatus() === "available" ? "unavailable" : "available");
  });

  function refresh() {
    togglePrice(pearlsToggle, pearlsPrice);
    togglePrice(grahamToggle, grahamPrice);
  }

  if (pearlsToggle) pearlsToggle.addEventListener("change", refresh);
  if (grahamToggle) grahamToggle.addEventListener("change", refresh);
  refresh();

  async function loadProduct() {
    try {
      const res = await fetch(`${API_BASE}/products/${SLUG}`);
      const p = await res.json();
      if (!res.ok) return;

      setStatus(p.status || "available");

      if (price12) price12.value = (p.prices?.oz12 ?? "").toString();
      if (price16) price16.value = (p.prices?.oz16 ?? "").toString();

      if (pearlsToggle) pearlsToggle.checked = !!p.addons?.pearls?.enabled;
      if (pearlsPrice) pearlsPrice.value = (p.addons?.pearls?.price ?? "").toString();

      if (grahamToggle) grahamToggle.checked = !!p.addons?.graham?.enabled;
      if (grahamPrice) grahamPrice.value = (p.addons?.graham?.price ?? "").toString();

      refresh();
    } catch {}
  }

  loadProduct();

  async function saveUpdate() {
    const oz12 = num(price12?.value, NaN);
    const oz16 = num(price16?.value, NaN);

    if (!Number.isFinite(oz12) || oz12 < 0 || !Number.isFinite(oz16) || oz16 < 0) {
      alert("Please enter valid numeric prices for 12oz and 16oz.");
      return;
    }

    const payload = {
      status: getStatus(),
      prices: { oz12, oz16 },
      addons: {
        pearls: { enabled: !!pearlsToggle?.checked, price: num(pearlsPrice?.value, 0) },
        graham: { enabled: !!grahamToggle?.checked, price: num(grahamPrice?.value, 0) },
      },
    };

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
      }

      await apiFetch(`/admin/products/${SLUG}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      alert("Product updated successfully!");
      window.location.href = "products.html";
    } catch (e) {
      alert(e.message || "Failed to save update");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save update";
      }
    }
  }

  if (saveBtn) saveBtn.addEventListener("click", saveUpdate);
})();
