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
const analyzeBtn = document.getElementById("analyze-btn");
const analysisDiv = document.getElementById("analysis");

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
      analyzeBtn.classList.remove("hidden");
      analyzeBtn.disabled = false;
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

// ── Analyze ─────────────────────────────────────────────────────
analyzeBtn.addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  const text = resultDiv.textContent;

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing…";
  analysisDiv.classList.add("hidden");
  analysisDiv.classList.remove("error");

  try {
    const { openai_api_key } = await chrome.storage.local.get("openai_api_key");
    const result = await analyzeJobPosting(text, openai_api_key);
    renderAnalysis(result);
  } catch (err) {
    analysisDiv.textContent = err.message;
    analysisDiv.classList.add("error");
    analysisDiv.classList.remove("hidden");
  }

  analyzeBtn.disabled = false;
  analyzeBtn.textContent = "Analyze with AI";
});

/**
 * Render the structured analysis result into the analysis container.
 */
function renderAnalysis(data) {
  analysisDiv.innerHTML = "";

  const sections = [
    { key: "skills", label: "Skills" },
    { key: "job",    label: "Job Topics" },
    { key: "tech",   label: "Technologies" },
  ];

  for (const { key, label } of sections) {
    const items = data[key];
    if (!items || !items.length) continue;

    const section = document.createElement("div");
    section.className = "analysis-section";

    const heading = document.createElement("h3");
    heading.textContent = label;
    section.appendChild(heading);

    for (const item of items) {
      const title = Object.keys(item)[0];
      const details = item[title];

      const card = document.createElement("div");
      card.className = "analysis-card";

      const titleEl = document.createElement("strong");
      titleEl.textContent = title;
      card.appendChild(titleEl);

      if (Array.isArray(details)) {
        const ul = document.createElement("ul");
        for (const d of details) {
          const li = document.createElement("li");
          li.textContent = d;
          ul.appendChild(li);
        }
        card.appendChild(ul);
      }

      section.appendChild(card);
    }

    analysisDiv.appendChild(section);
  }

  // Copy JSON button
  const copyBtn = document.createElement("button");
  copyBtn.className = "secondary-btn copy-btn";
  copyBtn.textContent = "Copy JSON";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    copyBtn.textContent = "Copied!";
    setTimeout(() => { copyBtn.textContent = "Copy JSON"; }, 1500);
  });
  analysisDiv.appendChild(copyBtn);

  analysisDiv.classList.remove("hidden");
}
