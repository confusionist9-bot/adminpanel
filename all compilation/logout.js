
(() => {
  const ADMIN_TOKEN_KEY = "adminToken";

  function goToLogin() {

    window.location.replace("/");
  }


  window.requireAdminLogin = function () {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      goToLogin();
      return false;
    }
    return true;
  };


  window.adminLogout = function () {
    const ok = confirm("Are you sure you want to log out?");
    if (!ok) return;

    localStorage.removeItem(ADMIN_TOKEN_KEY);
    goToLogin();
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.requireAdminLogin();
  });
})();
