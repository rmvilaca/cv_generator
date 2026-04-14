// ── DOM references ─────────────────────────────────────────────
const loginView     = document.getElementById("login-view");
const mainView      = document.getElementById("main-view");
const loginForm     = document.getElementById("login-form");
const emailInput    = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const loginError    = document.getElementById("login-error");
const loginBtn      = document.getElementById("login-btn");
const userEmail     = document.getElementById("user-email");
const signOutBtn    = document.getElementById("sign-out-btn");

const extractStep  = document.getElementById("extract-step");
const reviewStep   = document.getElementById("review-step");
const confirmStep  = document.getElementById("confirm-step");

const extractBtn   = document.getElementById("extract-btn");
const extractError = document.getElementById("extract-error");
const resultDiv    = document.getElementById("result");
const saveError    = document.getElementById("save-error");
const reExtractBtn = document.getElementById("re-extract-btn");
const saveBtn      = document.getElementById("save-btn");
const viewLink     = document.getElementById("view-link");
const newExtractBtn = document.getElementById("new-extract-btn");

// ── Init: check stored JWT ─────────────────────────────────────
chrome.storage.local.get(["jwt_token", "user_email"], ({ jwt_token, user_email }) => {
  if (jwt_token) {
    showMainView(user_email);
  } else {
    showLoginView();
  }
});

function showLoginView() {
  loginView.classList.remove("hidden");
  mainView.classList.add("hidden");
}

function showMainView(email) {
  loginView.classList.add("hidden");
  mainView.classList.remove("hidden");
  userEmail.textContent = email ?? "";
  showStep("extract");
}

function showStep(step) {
  extractStep.classList.toggle("hidden", step !== "extract");
  reviewStep.classList.toggle("hidden",  step !== "review");
  confirmStep.classList.toggle("hidden", step !== "confirm");
}

// ── Login ──────────────────────────────────────────────────────
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";

  try {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { email: emailInput.value, password: passwordInput.value } }),
    });

    if (!res.ok) throw new Error("Invalid credentials");

    const token = res.headers.get("Authorization");
    if (!token) throw new Error("No token in response");

    await chrome.storage.local.set({ jwt_token: token, user_email: emailInput.value });
    showMainView(emailInput.value);
  } catch {
    loginError.textContent = "Invalid email or password.";
    loginError.classList.remove("hidden");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
  }
});

// ── Sign out ───────────────────────────────────────────────────
signOutBtn.addEventListener("click", () => {
  chrome.storage.local.remove(["jwt_token", "user_email"], () => {
    showLoginView();
  });
});

// ── Extract ────────────────────────────────────────────────────
extractBtn.addEventListener("click", async () => {
  extractBtn.disabled = true;
  extractBtn.textContent = "Extracting…";
  extractError.classList.add("hidden");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: "extract" });

    if (response?.success && response.text?.trim()) {
      resultDiv.textContent = response.text;
      showStep("review");
    } else {
      extractBtn.disabled = false;
      extractBtn.textContent = "Extract job posting";
      extractError.textContent = response?.error ?? "No job description found on this page. Check config.js selector.";
      extractError.classList.remove("hidden");
    }
  } catch {
    extractBtn.disabled = false;
    extractBtn.textContent = "Extract job posting";
    extractError.textContent = "Could not connect to this page. Try refreshing first.";
    extractError.classList.remove("hidden");
  }
});

// ── Re-extract ─────────────────────────────────────────────────
reExtractBtn.addEventListener("click", () => {
  resultDiv.textContent = "";
  extractBtn.disabled = false;
  extractBtn.textContent = "Extract job posting";
  showStep("extract");
});

// ── Save to account ────────────────────────────────────────────
saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  saveError.classList.add("hidden");

  try {
    const { jwt_token } = await chrome.storage.local.get("jwt_token");
    if (!jwt_token) { showLoginView(); return; }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const res = await fetch(`${API_BASE_URL}/job_postings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": jwt_token,
      },
      body: JSON.stringify({ raw_text: resultDiv.textContent, url: tab.url }),
    });

    if (res.status === 401) {
      // Token expired — clear and re-login
      await chrome.storage.local.remove(["jwt_token", "user_email"]);
      showLoginView();
      return;
    }

    if (!res.ok) throw new Error(`API error ${res.status}`);

    const data = await res.json();
    // Link to the job posting detail page on the website
    const webAppUrl = API_BASE_URL.replace("/api", "");
    viewLink.href = `${webAppUrl}/job-postings/${data.id}`;
    showStep("confirm");
  } catch {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save to account";
    saveError.textContent = "Failed to save. Check your connection and try again.";
    saveError.classList.remove("hidden");
  }
});

// ── Extract another ────────────────────────────────────────────
newExtractBtn.addEventListener("click", () => {
  resultDiv.textContent = "";
  extractBtn.disabled = false;
  extractBtn.textContent = "Extract job posting";
  showStep("extract");
});
