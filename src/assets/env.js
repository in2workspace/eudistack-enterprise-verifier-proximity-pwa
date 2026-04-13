(function (window) {
  window.env = window.env || {};

  // ============================================
  // Enterprise Verifier Proximity PWA
  // Runtime Configuration (FASE 1 - API Integration)
  // ============================================
  
  // ── Backend Configuration (REQUIRED) ──
  // PWA consumes eudistack-core-verifier backend via HTTP + SSE
  window["env"]["verifierBackendUrl"] = "http://localhost:8082";
  
  // ── SSE Configuration ──
  window["env"]["sseTimeout"] = 120000; // 120 seconds
  
  // ── QR Code Configuration ──
  window["env"]["qrExpirationSeconds"] = 120; // 2 minutes
  
  // ── Multi-Tenancy Configuration ──
  // Change this value to switch themes: "kpmg" | "altia"
  // Can be overridden with URL parameter: ?tenant=altia
  window["env"]["tenant"] = "altia";
  
  // ── Legacy Configuration (Deprecated) ──
  window["env"]["verifier_name"] = "KPMG Verifier";
  window["env"]["verifier_did"] = "did:web:kpmg-verifier.demo.eudistack.com";
  window["env"]["qr_expiration_seconds"] = "120";
  window["env"]["audit_retention_days"] = "90";
  window["env"]["log_level"] = "debug";
  window["env"]["trusted_issuers_url"] = "assets/trust-framework/trusted-issuers.json";
  window["env"]["enable_service_worker"] = "true";
  window["env"]["enable_offline_mode"] = "true";
  window["env"]["logs_enabled"] = "false";
  window["env"]["verifier_mode"] = "browser";
})(this);
