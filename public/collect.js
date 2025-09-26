async function getConfig() {
  const res = await fetch("/config", { cache: "no-store" });
  return res.json();
}

function gatherClient() {
  const nav = navigator || {};
  const mem = typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined;

  return {
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: nav.language,
    languages: Array.isArray(nav.languages) ? nav.languages.slice(0, 10) : undefined,
    platform: nav.platform,
    ua: nav.userAgent,
    vendor: nav.vendor,
    hw: {
      memoryGB: mem,
      cores: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined
    },
    screen: {
      width: screen?.width,
      height: screen?.height,
      availWidth: screen?.availWidth,
      availHeight: screen?.availHeight,
      colorDepth: screen?.colorDepth,
      pixelRatio: window.devicePixelRatio
    },
    ref: document.referrer || location.href
  };
}

async function send(payload) {
  try {
    const res = await fetch("/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

(async function init() {
  const { consentRequired } = await getConfig();
  const payload = gatherClient();

  if (consentRequired) {
    const box = document.getElementById("consent");
    box.classList.remove("hidden");
    document.getElementById("agree").onclick = async () => {
      payload.consent = true;
      const r = await send(payload);
      setStatus(r.ok ? "Collected." : `Error: ${r.error || "unknown"}`);
      box.classList.add("hidden");
    };
    setStatus("Waiting for consent…");
  } else {
    payload.consent = false;
    const r = await send(payload);
    setStatus(r.ok ? "Collected." : `Error: ${r.error || "unknown"}`);
  }
})();
