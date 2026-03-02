chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MYHIRE_ADD_JOB") return;

  const { baseUrl, payload } = message;

  fetch(`${baseUrl}/api/import`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      sendResponse({ ok: response.ok, body });
    })
    .catch((error) => {
      sendResponse({ ok: false, body: { error: String(error) } });
    });

  return true;
});
