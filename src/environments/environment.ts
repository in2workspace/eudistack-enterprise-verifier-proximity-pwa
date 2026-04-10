export const environment = {
  production: false,
  
  // Backend configuration
  verifierBackendUrl: window["env"]?.["verifierBackendUrl"] || 'http://localhost:8082',
  
  // SSE configuration
  sseTimeout: window["env"]?.["sseTimeout"] || 120000, // 120 seconds
  
  // QR code configuration
  qrExpirationSeconds: window["env"]?.["qrExpirationSeconds"] || 120,
  
  // Legacy configuration (deprecated)
  trustedIssuersUrl: 'assets/trust-framework/trusted-issuers.json',
  logs_enabled: window["env"]?.["logs_enabled"] === "true",
  verifier_mode: window["env"]?.["verifier_mode"] || 'browser',
  
  appVersion: '1.0.0',
};
