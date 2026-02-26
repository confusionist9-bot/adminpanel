const API_BASE = "https://miyummybackend-se.onrender.com";
const ADMIN_TOKEN_KEY = "adminToken";

const loginBtn = document.getElementById("loginBtn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("error-message");
const togglePassword = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");

if (localStorage.getItem(ADMIN_TOKEN_KEY)) {
  window.location.href = "sales.html";
}

async function postJson(path, bodyObj) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj)
  });

  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch {}

  return { res, raw, data };
}

async function adminLogin(identifier, password) {

  const first = await postJson("/auth/admin-login", { identifier, password });

  console.log("ADMIN LOGIN (admin-login) STATUS:", first.res.status);
  console.log("ADMIN LOGIN (admin-login) RAW:", first.raw);

  if (first.res.ok) {

    const token = first.data?.token;
    if (!token) throw new Error("Login succeeded but token missing.");
    return token;
  }

  const looksLikeRouteMissing =
    first.res.status === 404 ||
    (first.raw && first.raw.includes("Cannot POST /auth/admin-login"));

  if (!looksLikeRouteMissing) {

    throw new Error(first.data?.message || first.raw || `Login failed (${first.res.status})`);
  }


  const second = await postJson("/auth/login", { identifier, password });

  console.log("ADMIN LOGIN (fallback /login) STATUS:", second.res.status);
  console.log("ADMIN LOGIN (fallback /login) RAW:", second.raw);

  if (!second.res.ok) {
    throw new Error(second.data?.message || second.raw || `Login failed (${second.res.status})`);
  }


  const token = second.data?.token;
  const user = second.data?.user;

  if (!token) throw new Error("Login succeeded but token missing.");
  if (!user || user.isAdmin !== true) {
    throw new Error("Admin only.");
  }

  return token;
}

loginBtn.addEventListener("click", async function () {
  errorMessage.textContent = "";

  const identifier = usernameInput.value.trim();
  const password = passwordInput.value;

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
    loginBtn.textContent = "Log in";
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter") loginBtn.click();
});

togglePassword.addEventListener("click", function () {
  const isPasswordHidden = passwordInput.type === "password";
  passwordInput.type = isPasswordHidden ? "text" : "password";

  eyeIcon.innerHTML = isPasswordHidden
    ? `<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.76 21.76 0 0 1 5.08-6.14M1 1l22 22"></path>
       <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88"></path>`
    : `<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
       <circle cx="12" cy="12" r="3"></circle>`;
});
