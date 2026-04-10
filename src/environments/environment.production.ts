export const environment = {
  production: true,
  
  // Backend configuration (must be set via window.env in production)
  verifierBackendUrl: (window as any)["env"]?.["verifierBackendUrl"] || '',
  
  // SSE configuration
  sseTimeout: (window as any)["env"]?.["sseTimeout"] || 120000,
  
  // QR code configuration
  qrExpirationSeconds: (window as any)["env"]?.["qrExpirationSeconds"] || 120,
  
  // Legacy
  trustedIssuersUrl: 'assets/trust-framework/trusted-issuers.json',
  logLevel: 'error',
  
  appVersion: '1.0.0',
};
