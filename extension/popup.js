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
const extractBtn = document.getElementById("extract-btn");
const analyzeBtn = document.getElementById("analyze-btn");
const analysisDiv = document.getElementById("analysis");
const resultDiv = document.getElementById("result");
const resultToggle = document.getElementById("result-toggle");

function setExtractedTextVisibility(isVisible) {
  resultDiv.classList.toggle("hidden", !isVisible);
}

function updateResultToggleLabel(isVisible) {
  resultToggle.textContent = isVisible ? "Hide extracted text" : "Show extracted text";
  resultToggle.setAttribute("aria-expanded", String(isVisible));
}

resultToggle.addEventListener("click", () => {
  const isVisible = resultDiv.classList.contains("hidden");
  setExtractedTextVisibility(isVisible);
  updateResultToggleLabel(isVisible);
});

extractBtn.addEventListener("click", async () => {
  extractBtn.disabled = true;
  extractBtn.textContent = "Extracting…";
  resultDiv.classList.add("hidden");
  resultDiv.classList.remove("error");
  resultToggle.classList.add("hidden");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "extract",
    });

    if (response?.success) {
      resultDiv.textContent = response.text;
      analyzeBtn.classList.remove("hidden");
      analyzeBtn.disabled = false;
      setExtractedTextVisibility(true);
      extractBtn.classList.add("hidden");
    } else {
      resultDiv.textContent = response?.error ?? "Unknown error.";
      resultDiv.classList.add("error");
      resultDiv.classList.remove("hidden");
      resultToggle.classList.add("hidden");
      extractBtn.classList.remove("hidden");
    }
  } catch (err) {
    resultDiv.textContent =
      "Could not connect to this page. Try refreshing the page first.";
    resultDiv.classList.add("error");
    resultDiv.classList.remove("hidden");
    resultToggle.classList.add("hidden");
    extractBtn.classList.remove("hidden");
  }

  extractBtn.disabled = false;
  extractBtn.textContent = "Extract";
});

// ── Analyze ─────────────────────────────────────────────────────
analyzeBtn.addEventListener("click", async () => {
  const text = resultDiv.textContent;

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing…";
  analysisDiv.classList.add("hidden");
  analysisDiv.classList.remove("error");

  try {
    const { openai_api_key } = await chrome.storage.local.get("openai_api_key");
    const result = await analyzeJobPosting(text, openai_api_key);
    renderAnalysis(result);
    setExtractedTextVisibility(false);
    resultToggle.classList.remove("hidden");
    updateResultToggleLabel(false);

    // Final step completed: hide action buttons after successful analysis.
    extractBtn.classList.add("hidden");
    analyzeBtn.classList.add("hidden");
  } catch (err) {
    analysisDiv.textContent = err.message;
    analysisDiv.classList.add("error");
    analysisDiv.classList.remove("hidden");
    setExtractedTextVisibility(true);
    resultToggle.classList.add("hidden");
    extractBtn.classList.remove("hidden");
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

    const headingBtn = document.createElement("button");
    headingBtn.type = "button";
    headingBtn.className = "analysis-toggle";
    headingBtn.setAttribute("aria-expanded", "false");

    const headingLabel = document.createElement("span");
    headingLabel.textContent = label;

    const headingIcon = document.createElement("span");
    headingIcon.className = "analysis-toggle-icon";
    headingIcon.textContent = "▸";

    headingBtn.appendChild(headingLabel);
    headingBtn.appendChild(headingIcon);
    section.appendChild(headingBtn);

    const sectionBody = document.createElement("div");
    sectionBody.className = "analysis-section-body hidden";

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

      sectionBody.appendChild(card);
    }

    headingBtn.addEventListener("click", () => {
      const isOpen = !sectionBody.classList.contains("hidden");
      sectionBody.classList.toggle("hidden", isOpen);
      headingBtn.setAttribute("aria-expanded", String(!isOpen));
      headingIcon.textContent = isOpen ? "▸" : "▾";
    });

    section.appendChild(sectionBody);

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
