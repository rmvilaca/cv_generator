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
