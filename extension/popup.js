// ── Settings panel ──────────────────────────────────────────────
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel  = document.getElementById("settings-panel");
const apiKeyInput    = document.getElementById("api-key-input");
const toggleVis      = document.getElementById("toggle-visibility");
const saveKeyBtn     = document.getElementById("save-key-btn");
const keyStatus      = document.getElementById("key-status");

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 5) + "•••" + key.slice(-4);
}

// Load saved key on popup open
chrome.storage.local.get("openai_api_key", ({ openai_api_key }) => {
  if (openai_api_key) {
    apiKeyInput.value = openai_api_key;
    keyStatus.textContent = `Saved: ${maskKey(openai_api_key)}`;
    keyStatus.classList.add("saved");
  }
});

// Toggle settings panel visibility
settingsToggle.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

// Toggle key visibility
toggleVis.addEventListener("click", () => {
  apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
});

// Save key
saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = "Please enter an API key.";
    keyStatus.classList.remove("saved");
    return;
  }
  chrome.storage.local.set({ openai_api_key: key }, () => {
    keyStatus.textContent = `Saved: ${maskKey(key)}`;
    keyStatus.classList.add("saved");
  });
});

// ── Extraction ─────────────────────────────────────────────────
document.getElementById("extract-btn").addEventListener("click", async () => {
  const btn = document.getElementById("extract-btn");
  const result = document.getElementById("result");

  btn.disabled = true;
  btn.textContent = "Extracting…";
  result.classList.add("hidden");
  result.classList.remove("error");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "extract",
    });

    if (response?.success) {
      result.textContent = response.text;
    } else {
      result.textContent = response?.error ?? "Unknown error.";
      result.classList.add("error");
    }
  } catch (err) {
    result.textContent =
      "Could not connect to this page. Try refreshing the page first.";
    result.classList.add("error");
  }

  result.classList.remove("hidden");
  btn.disabled = false;
  btn.textContent = "Extract";
});
