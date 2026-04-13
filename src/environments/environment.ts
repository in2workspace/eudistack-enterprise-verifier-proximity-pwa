export const environment = {
  production: false,
  
  // Backend configuration (getter to support dynamic runtime overrides)
  get verifierBackendUrl(): string {
    const url = window["env"]?.["verifierBackendUrl"];
    
    // If explicitly set and not empty, use it
    if (url && url !== '') {
      return url;
    }
    
    // If empty string, use same origin (nginx proxy mode)
    if (url === '') {
      return window.location.origin;
    }
    
    // Default fallback for development
    return 'http://localhost:8082';
  },
  
  // SSE configuration (getter to support dynamic runtime overrides)
  get sseTimeout(): number {
    return window["env"]?.["sseTimeout"] || 120000; // 120 seconds
  },
  
  // QR code configuration (getter to support dynamic runtime overrides)
  get qrExpirationSeconds(): number {
    return window["env"]?.["qrExpirationSeconds"] || 120;
  },
  
  // Legacy configuration (deprecated)
  trustedIssuersUrl: 'assets/trust-framework/trusted-issuers.json',
  get logs_enabled(): boolean {
    return window["env"]?.["logs_enabled"] === "true";
  },
  get verifier_mode(): string {
    return window["env"]?.["verifier_mode"] || 'browser';
  },
  
  appVersion: '1.0.0',
};
