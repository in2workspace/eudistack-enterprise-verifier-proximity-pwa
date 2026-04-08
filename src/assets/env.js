(function (window) {
  window.env = window.env || {};

  // KPMG Verifier PWA - Local Development Configuration
  // Note: This is a 100% PWA standalone app (no backend server required)
  
  // ── Multi-Tenancy Configuration ──
  // Change this value to switch themes: "kpmg" | "altia" | "dome"
  // Can be overridden with URL parameter: ?tenant=altia
  window["env"]["tenant"] = "kpmg";
  
  window["env"]["verifier_name"] = "KPMG Verifier";
  window["env"]["verifier_did"] = "did:web:kpmg-verifier.demo.eudistack.com";
  window["env"]["qr_expiration_seconds"] = "120";
  window["env"]["audit_retention_days"] = "90";
  window["env"]["log_level"] = "debug";
  window["env"]["trusted_issuers_url"] = "assets/trust-framework/trusted-issuers.json";
  
  // Service Worker & PWA settings
  window["env"]["enable_service_worker"] = "true";
  window["env"]["enable_offline_mode"] = "true";
})(this);
