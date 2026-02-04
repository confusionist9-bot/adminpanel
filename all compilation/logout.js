function goToLogin() {
  window.location.href = "/"; // index.html
}

function adminLogout() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  goToLogin();
}