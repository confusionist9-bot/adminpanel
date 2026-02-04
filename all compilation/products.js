// products.js (SECURED PAGE GUARD)
const ADMIN_TOKEN_KEY = "adminToken";

function requireAdminLogin() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    // block page immediately
    window.location.replace("login.html");
    return false;
  }
  return true;
}

// ✅ IMPORTANT: run guard on page load
document.addEventListener("DOMContentLoaded", () => {
  requireAdminLogin();
});

// Handle product clicks
function openProduct(productName) {
  if (!requireAdminLogin()) return;

  if (productName === "mango-graham") window.location.href = "edit-mango.html";
  if (productName === "avocado") window.location.href = "edit-avocado.html";
  if (productName === "cucumber") window.location.href = "edit-cucumber.html";
  if (productName === "guyabano") window.location.href = "edit-guyabano.html";
  if (productName === "melon") window.location.href = "edit-melon.html";
  if (productName === "strawberry") window.location.href = "edit-strawberry.html";
}
