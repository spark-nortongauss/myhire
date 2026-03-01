(() => {
  if (window.__myhirePluginLoaded) return;
  window.__myhirePluginLoaded = true;

  const root = document.createElement("div");
  root.id = "myhire-plugin-root";

  const launcher = document.createElement("button");
  launcher.className = "myhire-plugin-launcher";
  launcher.title = "MyHire Plugin";
  launcher.textContent = "M";

  const panel = document.createElement("div");
  panel.className = "myhire-plugin-panel myhire-plugin-hidden";
  panel.innerHTML = `
    <h4>MyHire Job Clipper</h4>
    <p>Visible on every page. Add Job to scrape this page and push it to MyHire.</p>
    <div class="myhire-plugin-field">
      <label>MyHire URL</label>
      <input id="myhire-base-url" class="myhire-plugin-input" placeholder="https://app.myhire.com" />
    </div>
    <div class="myhire-plugin-field">
      <label>CV file (optional)</label>
      <input id="myhire-cv-file" class="myhire-plugin-input" type="file" accept=".txt,.md,.pdf,.doc,.docx" />
    </div>
    <div class="myhire-plugin-actions">
      <button id="myhire-add-job" class="myhire-plugin-btn primary">Add Job</button>
      <button id="myhire-minimize" class="myhire-plugin-btn">Minimize</button>
    </div>
    <div id="myhire-status" class="myhire-plugin-status">Ready.</div>
  `;

  root.appendChild(launcher);
  root.appendChild(panel);
  document.documentElement.appendChild(root);

  const baseUrlInput = panel.querySelector("#myhire-base-url");
  const cvFileInput = panel.querySelector("#myhire-cv-file");
  const addJobBtn = panel.querySelector("#myhire-add-job");
  const minimizeBtn = panel.querySelector("#myhire-minimize");
  const status = panel.querySelector("#myhire-status");

  const setStatus = (message) => {
    status.textContent = message;
  };

  chrome.storage.sync.get(["myhireBaseUrl"], ({ myhireBaseUrl }) => {
    baseUrlInput.value = myhireBaseUrl || "http://localhost:3000";
  });

  launcher.addEventListener("click", () => {
    panel.classList.toggle("myhire-plugin-hidden");
  });

  minimizeBtn.addEventListener("click", () => {
    panel.classList.add("myhire-plugin-hidden");
  });

  addJobBtn.addEventListener("click", async () => {
    const baseUrl = baseUrlInput.value.trim().replace(/\/$/, "");
    if (!baseUrl) {
      setStatus("Please provide your MyHire URL.");
      return;
    }

    chrome.storage.sync.set({ myhireBaseUrl: baseUrl });

    const visibleText = (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 12000);
    const title = document.title || "Untitled role";
    const descriptionMeta = document.querySelector("meta[name='description']")?.getAttribute("content") || "";
    const payload = {
      url: window.location.href,
      content: `Job Title: ${title}\nSummary: ${descriptionMeta}\n\n${visibleText}`,
      cvText: "",
      cvVersionName: null,
      cvFilePath: null
    };

    const file = cvFileInput.files?.[0];
    if (file) {
      payload.cvVersionName = file.name;
      payload.cvFilePath = file.name;
      try {
        payload.cvText = await file.text();
      } catch (_error) {
        setStatus("CV selected, but text extraction failed (binary format). Continuing without CV text.");
      }
    }

    setStatus("Submitting job to MyHire...");

    try {
      chrome.runtime.sendMessage({ type: "MYHIRE_ADD_JOB", baseUrl, payload }, (response) => {
        if (chrome.runtime.lastError) {
          setStatus(`Error calling MyHire API: ${chrome.runtime.lastError.message}`);
          return;
        }

        const result = response?.body || {};
        if (!response?.ok) {
          setStatus(`Failed: ${result.error || "Unknown error"}`);
          return;
        }

        setStatus(`Success. Job created${result.jobId ? ` (ID: ${result.jobId})` : ""}.`);
      });
    } catch (error) {
      setStatus(`Error calling MyHire API: ${String(error)}`);
    }
  });
})();
