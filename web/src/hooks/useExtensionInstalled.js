import { useEffect, useState } from "react";

const isMarked = () =>
  document.documentElement.dataset.cvgExtension === "installed";

export function useExtensionInstalled() {
  const [installed, setInstalled] = useState(isMarked);

  useEffect(() => {
    if (installed) return;
    // Content script runs at document_idle; on slow loads it may stamp the
    // marker after we mount. Watch for the attribute appearing rather than
    // guessing a timeout.
    const observer = new MutationObserver(() => {
      if (isMarked()) setInstalled(true);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-cvg-extension"],
    });
    return () => observer.disconnect();
  }, [installed]);

  return installed;
}
