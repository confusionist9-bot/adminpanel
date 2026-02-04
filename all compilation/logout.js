// logout.js (GLOBAL ADMIN GUARD + LOGOUT)
// Works on ALL admin pages (branches, add/edit branch, edit flavors, etc.)

(() => {
  const ADMIN_TOKEN_KEY = "adminToken";
  const LOGIN_PAGE = "login.html";

  function goToLogin() {
    // replace prevents going "Back" into secured pages
    window.location.replace(LOGIN_PAGE);
  }

  // Make them GLOBAL so onclick="adminLogout()" works everywhere
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

  // Auto-guard: any page that includes logout.js becomes protected
  document.addEventListener("DOMContentLoaded", () => {
    window.requireAdminLogin();

    // If you want, this makes logout work even WITHOUT onclick=""
    const btn =
      document.getElementById("logoutBtn") ||
      document.querySelector(".logout");

    if (btn) {
      btn.addEventListener("click", (e) => {
        // if it was a link/button, stop weird default behavior
        e.preventDefault();

        if (confirm("Are you sure you want to log out?")) {
          window.adminLogout();
        }
      });
    }
  });
})();
