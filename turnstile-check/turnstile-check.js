/* B5i-B: REAL-SDK adapter prepared privately; LIVE BOOT DISABLED.
   This file does not load scripts, call fetch, store tokens, or contact AI.
   Public Site Key + HTTPS + explicit activation + Cloudflare SDK will be required
   in a separately approved future release. Never include a Secret Key. */
(function () {
  "use strict";
  const EXPECTED_HOST = "imadalimohammed.github.io";
  const EXPECTED_PATH = "/hylderuten-ai-staging/turnstile-check/";
  const MAX_TOKEN_CHARS = 2048;
  const MAX_TIMEOUT_MS = 30000;
  const codeError = (code) => Object.assign(new Error(code), { code });

  function validLocation(location) {
    try {
      const u = new URL(location.href);
      return u.protocol === "https:" && u.hostname === EXPECTED_HOST &&
        u.port === "" && (u.pathname === EXPECTED_PATH || u.pathname === EXPECTED_PATH + "index.html") &&
        u.username === "" && u.password === "";
    } catch { return false; }
  }

  function createLiveController({ widgetApi, sitekey, location, clock,
    container = "#check-widget", onState, timeoutMs = 20000 } = {}) {
    if (!validLocation(location)) throw codeError("HTTPS_STAGING_REQUIRED");
    if (typeof sitekey !== "string" || !/^0x[A-Za-z0-9_-]{10,200}$/.test(sitekey) ||
      /FAKE|PLACEHOLDER|TEST_KEY/i.test(sitekey)) throw codeError("PUBLIC_SITEKEY_REQUIRED");
    if (!widgetApi || !["render", "execute", "reset", "remove"].every(n => typeof widgetApi[n] === "function"))
      throw codeError("TURNSTILE_SDK_REQUIRED");
    if (typeof container !== "string" || !/^#[A-Za-z][\w-]*$/.test(container) ||
      !clock || typeof clock.schedule !== "function" || typeof clock.clear !== "function" ||
      (onState !== undefined && typeof onState !== "function") ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > MAX_TIMEOUT_MS)
      throw codeError("INVALID_CONFIGURATION");

    let pending = null, generation = 0, state = "idle", locked = false, disposed = false;
    function publish(s) {
      state = s;
      if (onState) { try { onState(s); } catch { /* UI failures cannot alter decisions */ } }
    }
    const current = a => pending === a && generation === a.generation;
    function settle(a, reason) {
      if (!current(a)) return;
      pending = null;
      generation++;
      let cleanupFailed = false;
      if (a.timer !== null) { try { clock.clear(a.timer); } catch { cleanupFailed = true; } }
      if (a.widgetId !== null) {
        try { widgetApi.reset(a.widgetId); } catch { cleanupFailed = true; }
        try { widgetApi.remove(a.widgetId); } catch { cleanupFailed = true; }
      }
      if (cleanupFailed) locked = true;
      const outcome = cleanupFailed ? "RESET_FAILED" : reason;
      publish(disposed ? "disposed" : locked ? "locked" : outcome === "TOKEN_RECEIVED" ? "received" : outcome === "CANCELLED" ? "idle" : "failed");
      if (outcome === "TOKEN_RECEIVED") a.resolve(Object.freeze({ received: true, verified: false }));
      else a.reject(codeError(outcome));
    }
    function start() {
      if (disposed) return Promise.reject(codeError("DISPOSED"));
      if (locked) return Promise.reject(codeError("RESET_FAILED"));
      if (pending) return Promise.reject(codeError("REQUEST_IN_PROGRESS"));
      if (state !== "idle") return Promise.reject(codeError("RESET_REQUIRED"));
      const id = ++generation;
      publish("pending");
      return new Promise((resolve, reject) => {
        const a = { generation: id, resolve, reject, widgetId: null,
          timer: null, initializing: true, early: null };
        pending = a;
        const signal = reason => {
          if (!current(a)) return;
          if (a.initializing) { if (a.early === null) a.early = reason; return; }
          settle(a, reason);
        };
        const options = {
          sitekey, action: "interpret", execution: "execute", appearance: "execute",
          retry: "never", "refresh-expired": "never", "refresh-timeout": "never",
          "response-field": false,
          callback: token => signal(typeof token === "string" && !!token.trim() &&
            token.length <= MAX_TOKEN_CHARS ? "TOKEN_RECEIVED" : "TOKEN_INVALID"),
          "expired-callback": () => signal("TOKEN_EXPIRED"),
          "timeout-callback": () => signal("WIDGET_TIMEOUT"),
          "unsupported-callback": () => signal("UNSUPPORTED_BROWSER"),
          "error-callback": () => { signal("WIDGET_ERROR"); return true; }
        };
        try {
          a.widgetId = widgetApi.render(container, options);
          if (!(typeof a.widgetId === "string" && a.widgetId.length > 0) &&
            !(typeof a.widgetId === "number" && Number.isSafeInteger(a.widgetId) && a.widgetId >= 0))
            throw codeError("WIDGET_UNAVAILABLE");
          a.initializing = false;
          if (a.early !== null) { settle(a, a.early); return; }
          a.timer = clock.schedule(() => signal("WIDGET_TIMEOUT"), timeoutMs);
          const execution = widgetApi.execute(a.widgetId);
          if (execution && typeof execution.catch === "function")
            execution.catch(() => signal("WIDGET_UNAVAILABLE"));
        } catch {
          a.initializing = false;
          signal("WIDGET_UNAVAILABLE");
        }
      });
    }
    function reset() {
      if (disposed) throw codeError("DISPOSED");
      if (pending) settle(pending, "CANCELLED");
      if (locked) throw codeError("RESET_FAILED");
      publish("idle");
      return true;
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      if (pending) settle(pending, "DISPOSED");
      publish("disposed");
    }
    return Object.freeze({ start, reset, dispose, status: () => state });
  }
  window.HR_B5IB_REAL_PREP = Object.freeze({ createLiveController });

  /* Deliberate double lock. A future approved public release must change the
     HTML activation marker AND provide a public sitekey and official SDK script.
     None is present in the private candidate. */
  if (typeof document === "undefined") return;
  const root = document.getElementById("turnstile-live-root");
  if (!root || root.getAttribute("data-activation") !== "approved") return;
  const sitekey = root.getAttribute("data-public-sitekey") || "";
  if (!validLocation(window.location) || !sitekey) return;
  let controller = null;
  window.HR_B5IB_onTurnstileReady = function () {
    if (controller || !window.turnstile) return;
    const btnStart = document.getElementById("start-check");
    const btnReset = document.getElementById("reset-check");
    const status = document.getElementById("check-status");
    if (!btnStart || !btnReset || !status) return;
    const messages = Object.freeze({
      idle: "Klar til sikkerhedskontrol.", pending: "Sikkerhedskontrol i gang.",
      received: "Turnstile-token modtaget i browseren. IKKE servervalideret.",
      failed: "Sikkerhedskontrollen blev ikke gennemført. Nulstil for at prøve igen.",
      locked: "Sikkerhedskontrollen er låst efter en fejl.", disposed: "Kontrollen er afsluttet."
    });
    try {
      controller = createLiveController({ widgetApi: window.turnstile, sitekey,
        location: window.location, container: "#check-widget",
        clock: { schedule: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) },
        onState: code => { status.textContent = messages[code] || messages.failed; } });
      btnStart.disabled = false;
      btnReset.disabled = false;
      btnStart.onclick = async () => {
        btnStart.disabled = true;
        try { await controller.start(); } catch { /* status is safe and neutral */ }
        finally { btnStart.disabled = false; }
      };
      btnReset.onclick = () => {
        try { controller.reset(); } catch { status.textContent = messages.locked; }
      };
    } catch { status.textContent = "Sikkerhedskontrollen kan ikke startes."; }
  };
})();