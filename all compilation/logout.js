// logout.js (works on Vercel + blocks secured pages)
(() => {
  const ADMIN_TOKEN_KEY = "adminToken";

  function goToLogin() {
    // ✅ your login is index.html at site root
    window.location.replace("/");
  }

  // ✅ global functions for onclick="adminLogout()"
  window.requireAdminLogin = function requireAdminLogin() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      goToLogin();
      return false;
    }
    return true;
  };

  window.adminLogout = function adminLogout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    goToLogin();
  };

  document.addEventListener("DOMContentLoaded", () => {
    // ✅ protect every page that includes logout.js
    window.requireAdminLogin();

    // ✅ make logout work even if it's an <a href="..."> or button
    const logoutEl =
      document.getElementById("logoutBtn") ||
      document.querySelector(".logout") ||
      document.querySelector("[data-logout]");

    if (logoutEl) {
      logoutEl.addEventListener("click", (e) => {
        e.preventDefault();   // ✅ stops link navigation to 404
        e.stopPropagation();

        if (confirm("Are you sure you want to log out?")) {
          window.adminLogout();
        }
      });
    }
  });
})();
