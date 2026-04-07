import { TrustedIssuer } from './trusted-issuer.model';

/**
 * Trust Framework JSON structure
 * 
 * Structure of the trusted-issuers.json file loaded from assets.
 */
export interface TrustFrameworkJson {
  version: string;
  lastUpdated: string;
  description?: string;
  trustedIssuers: TrustedIssuer[];
  metadata?: {
    totalIssuers: number;
    activeIssuers: number;
    suspendedIssuers?: number;
    revokedIssuers?: number;
    eidasIssuers: number;
    supportedMethods?: string[];
    unsupportedMethods?: string[];
  };
}

/**
 * Trust Framework Metadata
 * 
 * Runtime metadata about the loaded trust framework.
 */
export interface TrustFrameworkMetadata {
  version: string;
  lastUpdated: string;
  totalIssuers: number;
  activeIssuers: number;
  eidasIssuers: number;
}
