const API_BASE = "https://miyummybackend.onrender.com";
const ADMIN_TOKEN_KEY = "adminToken";

// DOM
const loginBtn = document.getElementById("loginBtn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("error-message");
const togglePassword = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");

// If already logged in, go to dashboard
if (localStorage.getItem(ADMIN_TOKEN_KEY)) {
  window.location.href = "sales.html";
}

async function adminLogin(identifier, password) {
  const res = await fetch(`${API_BASE}/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password })
  });

  // ✅ Read text first so we can show it even if JSON fails
  const raw = await res.text();
  let data = {};
  try { data = JSON.parse(raw); } catch {}

  // ✅ DEBUG: see exact response
  console.log("ADMIN LOGIN STATUS:", res.status);
  console.log("ADMIN LOGIN RAW:", raw);

  if (!res.ok) {
    // show exact backend message on screen
    throw new Error(data.message || raw || `Login failed (${res.status})`);
  }

  return data.token;
}


loginBtn.addEventListener("click", async function () {
  errorMessage.textContent = "";

  const identifier = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!identifier || !password) {
    errorMessage.textContent = "Please enter username/email and password.";
    errorMessage.style.color = "red";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  try {
    const token = await adminLogin(identifier, password);
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    window.location.href = "sales.html";
  } catch (e) {
    errorMessage.textContent = e.message || "Invalid login.";
    errorMessage.style.color = "red";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});

// Enter key triggers login
document.addEventListener("keypress", function (event) {
  if (event.key === "Enter") loginBtn.click();
});

// Toggle password visibility
togglePassword.addEventListener("click", function () {
  const isPasswordHidden = passwordInput.type === "password";
  passwordInput.type = isPasswordHidden ? "text" : "password";

  eyeIcon.innerHTML = isPasswordHidden
    ? `<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.76 21.76 0 0 1 5.08-6.14M1 1l22 22"></path>
       <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88"></path>`
    : `<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
       <circle cx="12" cy="12" r="3"></circle>`;
});
