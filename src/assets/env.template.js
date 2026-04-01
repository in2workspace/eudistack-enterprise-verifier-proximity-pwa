(function (window) {
  window.env = window.env || {};

  // KPMG Verifier PWA - Environment Template
  // Replace ${VAR_NAME} with actual values during deployment
  
  window["env"]["verifier_name"] = "${VERIFIER_NAME}";
  window["env"]["verifier_did"] = "${VERIFIER_DID}";
  window["env"]["qr_expiration_seconds"] = "${QR_EXPIRATION_SECONDS}";
  window["env"]["audit_retention_days"] = "${AUDIT_RETENTION_DAYS}";
  window["env"]["log_level"] = "${LOG_LEVEL}";
  window["env"]["trusted_issuers_url"] = "${TRUSTED_ISSUERS_URL}";
  
  // Service Worker & PWA settings
  window["env"]["enable_service_worker"] = "${ENABLE_SERVICE_WORKER}";
  window["env"]["enable_offline_mode"] = "${ENABLE_OFFLINE_MODE}";
})(this);
