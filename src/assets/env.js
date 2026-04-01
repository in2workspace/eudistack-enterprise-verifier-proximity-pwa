(function (window) {
  window.env = window.env || {};

  // KPMG Verifier PWA - Local Development Configuration
  // Note: This is a 100% PWA standalone app (no backend server required)
  
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
