(function (window) {
  window.env = window.env || {};

  // ── Backend Configuration ──
  window["env"]["verifierBackendUrl"] = "http://localhost:8082";

  // ── SSE Configuration ──
  window["env"]["sseTimeout"] = 120000; // 120 seconds

  // ── QR Code Configuration ──
  window["env"]["qrExpirationSeconds"] = 120; // 2 minutes

  // ── Multi-Tenancy Configuration ──
  // Change this value to switch themes: "kpmg" | "altia"
  // Can be overridden with URL parameter: ?tenant=altia
  window["env"]["tenant"] = "kpmg";

  // ── Wallet URL ──
  // Used to build scannable HTTPS QR codes (camera-friendly) instead of openid4vp://
  window["env"]["walletUrl"] = "https://wallet.127.0.0.1.nip.io:4443";

  // ── Logging ──
  window["env"]["logs_enabled"] = "false";
  window["env"]["verifier_mode"] = "browser";
})(this);
