const f = document.getElementById("f");
const msg = document.getElementById("msg");

function show(type, text) {
  msg.className = type;
  msg.textContent = text;
}

// Collect as much automatic data as possible (no user input)
function getFingerprint() {
  const nav = navigator;
  const screen = window.screen;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  return {
    referrer: document.referrer || null,
    referrer_clean: document.referrer ? (new URL(document.referrer)).origin : null,
    screen_w: screen.width,
    screen_h: screen.height,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezone_offset: new Date().getTimezoneOffset(),
    language: nav.language,
    languages: nav.languages ? Array.from(nav.languages) : null,
    platform: nav.platform,
    deviceMemory: nav.deviceMemory ?? null,
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    maxTouchPoints: nav.maxTouchPoints ?? null,
    cookieEnabled: nav.cookieEnabled,
    doNotTrack: nav.doNotTrack ?? null,
    pdfViewerEnabled: nav.pdfViewerEnabled ?? null,
    connection_type: connection ? connection.effectiveType : null,
    connection_downlink: connection ? connection.downlink : null,
    connection_rtt: connection ? connection.rtt : null,
    color_depth: screen.colorDepth,
    pixel_ratio: window.devicePixelRatio ?? null,
    session_storage: typeof sessionStorage !== "undefined",
    local_storage: (function () { try { return !!localStorage; } catch (_) { return false; } })(),
    local_time: new Date().toISOString()
  };
}

// Read sender phone from SMS link: ?from=+15551234567 or ?phone=+15551234567
function getPhoneFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("from") || params.get("phone") || "").trim();
}

const fingerprint = getFingerprint();

// Record visit immediately (we get data even if they never submit)
(function () {
  const phoneFromUrl = getPhoneFromUrl();
  if (phoneFromUrl) {
    const phoneInput = document.getElementById("phone");
    if (phoneInput && !phoneInput.value) phoneInput.value = phoneFromUrl;
  }
  fetch("/api/visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_from_url: phoneFromUrl || null, fingerprint })
  }).catch(function () {});
})();

f.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.className = "";
  msg.textContent = "";

  const data = new URLSearchParams(new FormData(f));
  data.set("fingerprint", JSON.stringify(fingerprint));
  try {
    const r = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: data.toString()
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      show("err", j.error || "Submission failed.");
      return;
    }
    f.reset();
    show("ok", "Submitted. If appropriate, you'll receive a reply.");
  } catch (err) {
    show("err", "Network error. Try again later.");
  }
});
