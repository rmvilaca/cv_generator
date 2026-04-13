# CV Generator — Chrome Extension Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the extension to a thin authenticated sender — it extracts job posting text from any page, signs in with the user's account, and saves postings to the Rails API. All AI work moves to the backend.

**Architecture:** Remove all OpenAI code. The popup shows a login form if the user is not signed in. After login the JWT is stored in `chrome.storage.local`. Extract flow: Extract text → review → Save to account → confirmation with a link to the web app.

**Tech Stack:** Chrome Extension Manifest V3, plain JS. No new dependencies.

**Prerequisite:** The Rails API (see `2026-04-13-api-plan.md`) must be running. The API base URL is configured in `config.js`.

---

## File Map

```
cv_generator/extension/
├── manifest.json     MODIFIED — remove ai.js reference if present
├── config.js         MODIFIED — add API_BASE_URL, remove TARGET_SELECTOR or keep it
├── content.js        UNCHANGED
├── popup.html        REWRITTEN — add login form, remove analysis UI
├── popup.css         MODIFIED — simplified
├── popup.js          REWRITTEN — login flow, save-to-account flow
└── ai.js             DELETED
```

---

## Task 1: Update config.js

**Files:**
- Modify: `extension/config.js`

- [ ] **Step 1: Read current config.js**

Read `extension/config.js` to see the current content.

- [ ] **Step 2: Replace config.js**

Replace `extension/config.js` with:
```js
// CSS selector used to extract job description text from the current page.
// Change this to match the job board you're targeting.
const TARGET_SELECTOR = ".job-description";

// Base URL of the Rails API.
// Change to your production URL when deploying.
const API_BASE_URL = "http://localhost:3000/api";
```

- [ ] **Step 3: Commit**

```bash
git add extension/config.js
git commit -m "chore: add API_BASE_URL to extension config"
```

---

## Task 2: Delete ai.js

**Files:**
- Delete: `extension/ai.js`

- [ ] **Step 1: Delete the file**

```bash
rm cv_generator/extension/ai.js
```

- [ ] **Step 2: Commit**

```bash
git add extension/ai.js
git commit -m "chore: remove ai.js — AI analysis moves to backend"
```

---

## Task 3: Rewrite popup.html

**Files:**
- Modify: `extension/popup.html`

- [ ] **Step 1: Read current popup.html to understand the structure**

Read `extension/popup.html`.

- [ ] **Step 2: Replace popup.html**

Replace `extension/popup.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CV Generator</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <!-- ── Login view (shown when not signed in) ─────────────── -->
  <div id="login-view" class="view hidden">
    <h1>CV Generator</h1>
    <p>Sign in to save job postings to your account.</p>
    <form id="login-form">
      <label for="email-input">Email</label>
      <input id="email-input" type="email" placeholder="you@example.com" required />
      <label for="password-input">Password</label>
      <input id="password-input" type="password" placeholder="Password" required />
      <p id="login-error" class="error hidden"></p>
      <button id="login-btn" type="submit">Sign in</button>
    </form>
  </div>

  <!-- ── Main view (shown when signed in) ──────────────────── -->
  <div id="main-view" class="view hidden">
    <div class="header">
      <span id="user-email" class="user-email"></span>
      <button id="sign-out-btn" class="link-btn">Sign out</button>
    </div>

    <!-- Extract step -->
    <div id="extract-step">
      <button id="extract-btn" class="primary-btn">Extract job posting</button>
    </div>

    <!-- Review step -->
    <div id="review-step" class="hidden">
      <p class="step-label">Review extracted text:</p>
      <div id="result" class="result-box"></div>
      <p id="extract-error" class="error hidden"></p>
      <div class="button-row">
        <button id="re-extract-btn" class="secondary-btn">Re-extract</button>
        <button id="save-btn" class="primary-btn">Save to account</button>
      </div>
    </div>

    <!-- Confirm step -->
    <div id="confirm-step" class="hidden">
      <p class="success-msg">✓ Saved! Analysis is running in the background.</p>
      <a id="view-link" href="#" target="_blank" class="view-link">View on website →</a>
      <button id="new-extract-btn" class="secondary-btn">Extract another</button>
    </div>
  </div>

  <script src="config.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add extension/popup.html
git commit -m "feat: rewrite popup.html with login and save-to-account flow"
```

---

## Task 4: Rewrite popup.css

**Files:**
- Modify: `extension/popup.css`

- [ ] **Step 1: Replace popup.css**

Replace `extension/popup.css`:
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  width: 320px;
  padding: 16px;
  background: #fff;
  color: #1a1a1a;
}

h1 { font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }

.view.hidden { display: none; }

/* Login */
#login-view p { color: #555; margin-bottom: 12px; font-size: 0.875rem; }
#login-form label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 2px; margin-top: 10px; }
#login-form input { width: 100%; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }

/* Header */
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.user-email { font-size: 0.8rem; color: #555; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.link-btn { background: none; border: none; color: #2563eb; cursor: pointer; font-size: 0.8rem; padding: 0; }
.link-btn:hover { text-decoration: underline; }

/* Buttons */
.primary-btn {
  width: 100%; padding: 8px; background: #2563eb; color: #fff;
  border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; margin-top: 8px;
}
.primary-btn:hover { background: #1d4ed8; }
.primary-btn:disabled { opacity: 0.6; cursor: default; }
.secondary-btn {
  flex: 1; padding: 8px; background: #f3f4f6; color: #374151;
  border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; font-size: 0.9rem;
}
.secondary-btn:hover { background: #e5e7eb; }
.button-row { display: flex; gap: 8px; margin-top: 8px; }

/* Result box */
.result-box {
  max-height: 140px; overflow-y: auto; padding: 8px;
  background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px;
  font-size: 0.8rem; line-height: 1.4; white-space: pre-wrap; word-break: break-word;
  margin-top: 8px;
}
.step-label { font-size: 0.8rem; color: #555; margin-bottom: 4px; }

/* Status */
.error { color: #dc2626; font-size: 0.8rem; margin-top: 6px; }
.error.hidden { display: none; }
.success-msg { color: #166534; font-size: 0.9rem; margin-bottom: 8px; }
.view-link { display: block; color: #2563eb; text-decoration: none; font-size: 0.875rem; margin-bottom: 8px; }
.view-link:hover { text-decoration: underline; }
```

- [ ] **Step 2: Commit**

```bash
git add extension/popup.css
git commit -m "feat: update popup styles for new flow"
```

---

## Task 5: Rewrite popup.js

**Files:**
- Modify: `extension/popup.js`

- [ ] **Step 1: Replace popup.js**

Replace `extension/popup.js`:
```js
// ── DOM references ─────────────────────────────────────────────
const loginView    = document.getElementById("login-view");
const mainView     = document.getElementById("main-view");
const loginForm    = document.getElementById("login-form");
const emailInput   = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const loginError   = document.getElementById("login-error");
const loginBtn     = document.getElementById("login-btn");
const userEmail    = document.getElementById("user-email");
const signOutBtn   = document.getElementById("sign-out-btn");

const extractStep  = document.getElementById("extract-step");
const reviewStep   = document.getElementById("review-step");
const confirmStep  = document.getElementById("confirm-step");

const extractBtn   = document.getElementById("extract-btn");
const resultDiv    = document.getElementById("result");
const extractError = document.getElementById("extract-error");
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

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: "extract" });

    if (response?.success && response.text?.trim()) {
      resultDiv.textContent = response.text;
      extractError.classList.add("hidden");
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
    extractError.textContent = "Failed to save. Check your connection and try again.";
    extractError.classList.remove("hidden");
  }
});

// ── Extract another ────────────────────────────────────────────
newExtractBtn.addEventListener("click", () => {
  resultDiv.textContent = "";
  extractBtn.disabled = false;
  extractBtn.textContent = "Extract job posting";
  showStep("extract");
});
```

- [ ] **Step 2: Commit**

```bash
git add extension/popup.js
git commit -m "feat: rewrite popup.js with login and save-to-account flow"
```

---

## Task 6: Update manifest.json

**Files:**
- Modify: `extension/manifest.json`

- [ ] **Step 1: Read current manifest.json**

Read `extension/manifest.json`.

- [ ] **Step 2: Verify ai.js is not referenced and update name**

In `manifest.json`, ensure:
- `ai.js` does not appear in any `js` array
- The name reflects the new purpose

Replace `extension/manifest.json`:
```json
{
  "name": "CV Generator — Job Saver",
  "description": "Extract job postings and save them to your CV Generator account.",
  "version": "2.0.0",
  "manifest_version": 3,
  "action": {
    "default_popup": "popup.html"
  },
  "permissions": ["activeTab", "scripting", "storage"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["config.js", "content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add extension/manifest.json
git commit -m "chore: update manifest — remove ai.js, bump version to 2.0.0"
```

---

## Task 7: Manual end-to-end test

The extension has no automated tests (Chrome APIs are not testable in Node). Verify manually:

- [ ] **Step 1: Load the extension in Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `cv_generator/extension/`
4. Click the extension icon

Expected: Login form appears.

- [ ] **Step 2: Sign in**

Enter credentials for a test account in the Rails API. Expected: main view with user email shown.

- [ ] **Step 3: Extract and save**

1. Navigate to any job posting page
2. Click **Extract job posting**
3. Expected: extracted text shown in the review box
4. Click **Save to account**
5. Expected: confirm step with "✓ Saved!" and a "View on website" link

- [ ] **Step 4: Verify in the web app**

Open the link from Step 3. Expected: job posting appears in the list with `analysis_status: pending` (turns to `completed` after background job runs).

- [ ] **Step 5: Sign out**

Click **Sign out**. Expected: login form re-appears. `jwt_token` removed from `chrome.storage.local`.
