export const environment = {
  production: false,
  trustedIssuersUrl: 'assets/trust-framework/trusted-issuers.json',
  logs_enabled: window["env"]?.["logs_enabled"] === "true",
  verifier_mode: window["env"]?.["verifier_mode"] || 'browser',
  appVersion: '1.0.0',
};
