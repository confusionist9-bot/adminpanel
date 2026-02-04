// logout.js (single source of truth for logout)
(() => {
  const ADMIN_TOKEN_KEY = "adminToken";

  function goToLogin() {
    // your login page is index.html at root
    window.location.replace("/");
  }

  // 🔒 page guard
  window.requireAdminLogin = function () {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      goToLogin();
      return false;
    }
    return true;
  };

  // ✅ CENTRALIZED LOGOUT (with confirm)
  window.adminLogout = function () {
    const ok = confirm("Are you sure you want to log out?");
    if (!ok) return; // ✅ Cancel = stay logged in

    localStorage.removeItem(ADMIN_TOKEN_KEY);
    goToLogin();
  };

  // 🔒 auto-guard on load
  document.addEventListener("DOMContentLoaded", () => {
    window.requireAdminLogin();
  });
})();
