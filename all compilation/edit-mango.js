
(function () {
  const API_BASE = "https://miyummybackend.onrender.com";
  const SLUG = "mango-graham";

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

  function toNumber(v, fallback = 0) {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : fallback;
  }

  function enforceNumericInput(el) {
    if (!el) return;
    el.addEventListener("input", function (e) {
      let val = e.target.value;
      val = val.replace(/[^\d.]/g, "");

      const parts = val.split(".");
      if (parts.length > 2) {
        val = parts[0] + "." + parts.slice(1).join("");
      }

      const parts2 = val.split(".");
      if (parts2[1]) {
        parts2[1] = parts2[1].slice(0, 2);
        val = parts2[0] + "." + parts2[1];
      }

      e.target.value = val;
    });
  }

  function setPillStatus(pill, status) {
    if (!pill) return;
    const textEl = pill.querySelector(".pill-text");
    pill.setAttribute("data-status", status);
    if (textEl) textEl.textContent = status === "available" ? "Available" : "Unavailable";
  }

  function getPillStatus(pill) {
    if (!pill) return "available";
    const s = pill.getAttribute("data-status");
    return s === "unavailable" ? "unavailable" : "available";
  }

  function toggleAddonUI(toggleEl, priceEl) {
    if (!toggleEl || !priceEl) return;
    const on = !!toggleEl.checked;

    if (on) {
      priceEl.removeAttribute("disabled");
      priceEl.style.opacity = "1";
    } else {
      priceEl.setAttribute("disabled", "true");
      priceEl.style.opacity = "0.5";
    }
  }

  const price12 = document.getElementById("price12");
  const price16 = document.getElementById("price16");

  const addonPearlsToggle = document.getElementById("addonPearlsToggle");
  const addonGrahamToggle = document.getElementById("addonGrahamToggle");
  const addonMangoBitsToggle = document.getElementById("addonMangoBitsToggle");

  const addonPearlsPrice = document.getElementById("addonPearlsPrice");
  const addonGrahamPrice = document.getElementById("addonGrahamPrice");
  const addonMangoBitsPrice = document.getElementById("addonMangoBitsPrice");

  const productStatusPill = document.getElementById("productStatusPill");
  const saveBtn = document.getElementById("saveBtn");

  requireAdminLogin();

  [price12, price16, addonPearlsPrice, addonGrahamPrice, addonMangoBitsPrice].forEach(enforceNumericInput);

  if (productStatusPill) {
    productStatusPill.addEventListener("click", () => {
      const curr = getPillStatus(productStatusPill);
      setPillStatus(productStatusPill, curr === "available" ? "unavailable" : "available");
    });
  }

  function refreshAddonStates() {
    toggleAddonUI(addonPearlsToggle, addonPearlsPrice);
    toggleAddonUI(addonGrahamToggle, addonGrahamPrice);
    toggleAddonUI(addonMangoBitsToggle, addonMangoBitsPrice);
  }

  [addonPearlsToggle, addonGrahamToggle, addonMangoBitsToggle].forEach((t) => {
    if (!t) return;
    t.addEventListener("change", refreshAddonStates);
  });

  refreshAddonStates();

  async function loadProduct() {
    try {
      const res = await fetch(`${API_BASE}/products/${SLUG}`, { method: "GET" });
      const p = await res.json();

      if (!res.ok) return;

      setPillStatus(productStatusPill, p.status || "available");

      if (price12) price12.value = (p.prices?.oz12 ?? "").toString();
      if (price16) price16.value = (p.prices?.oz16 ?? "").toString();

      if (addonPearlsToggle) addonPearlsToggle.checked = !!p.addons?.pearls?.enabled;
      if (addonGrahamToggle) addonGrahamToggle.checked = !!p.addons?.graham?.enabled;
      if (addonMangoBitsToggle) addonMangoBitsToggle.checked = !!p.addons?.mangobits?.enabled;

      if (addonPearlsPrice) addonPearlsPrice.value = (p.addons?.pearls?.price ?? "").toString();
      if (addonGrahamPrice) addonGrahamPrice.value = (p.addons?.graham?.price ?? "").toString();
      if (addonMangoBitsPrice) addonMangoBitsPrice.value = (p.addons?.mangobits?.price ?? "").toString();

      refreshAddonStates();
    } catch {}
  }

  loadProduct();

  async function saveUpdate() {
    const status = getPillStatus(productStatusPill);

    const oz12 = toNumber(price12?.value, NaN);
    const oz16 = toNumber(price16?.value, NaN);

    if (!Number.isFinite(oz12) || oz12 < 0 || !Number.isFinite(oz16) || oz16 < 0) {
      alert("Please enter valid numeric prices for 12oz and 16oz.");
      return;
    }

    const pearlsEnabled = !!addonPearlsToggle?.checked;
    const grahamEnabled = !!addonGrahamToggle?.checked;
    const mangobitsEnabled = !!addonMangoBitsToggle?.checked;

    const pearlsPrice = toNumber(addonPearlsPrice?.value, 0);
    const grahamPrice = toNumber(addonGrahamPrice?.value, 0);
    const mangobitsPrice = toNumber(addonMangoBitsPrice?.value, 0);

    if (pearlsEnabled && (!Number.isFinite(pearlsPrice) || pearlsPrice < 0)) {
      alert("Please enter a valid price for Pearls add-on.");
      return;
    }
    if (grahamEnabled && (!Number.isFinite(grahamPrice) || grahamPrice < 0)) {
      alert("Please enter a valid price for Graham add-on.");
      return;
    }
    if (mangobitsEnabled && (!Number.isFinite(mangobitsPrice) || mangobitsPrice < 0)) {
      alert("Please enter a valid price for Mango Bits add-on.");
      return;
    }

    const payload = {
      status,
      prices: { oz12, oz16 },
      addons: {
        pearls: { enabled: pearlsEnabled, price: pearlsPrice },
        graham: { enabled: grahamEnabled, price: grahamPrice },
        mangobits: { enabled: mangobitsEnabled, price: mangobitsPrice },
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

  if (saveBtn) {
    saveBtn.addEventListener("click", saveUpdate);
  }
})();
