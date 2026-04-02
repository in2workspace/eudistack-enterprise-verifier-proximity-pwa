import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from, firstValueFrom } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { StatusListEntry } from '../models/status-list-entry.model';

/**
 * Status List Service
 * 
 * Implements W3C Bitstring Status List 2021 verification.
 * 
 * Features:
 * - Extract status list URL and index from VC
 * - Fetch and parse bitstring status lists
 * - Check credential revocation status
 * - Cache status lists (5 min TTL) in IndexedDB
 * - Graceful error handling (doesn't block validation)
 * 
 * Spec: https://w3c.github.io/vc-bitstring-status-list/
 * 
 * @service
 * @injectable
 */
@Injectable({
  providedIn: 'root'
})
export class StatusListService {
  private static readonly CACHE_TTL_SECONDS = 300; // 5 minutes

  public constructor(
    private http: HttpClient,
    private storage: StorageService
  ) {}

  /**
   * Check if a credential is revoked
   * 
   * Extracts status list information from VC, fetches the status list,
   * and checks the credential's revocation status.
   * 
   * @param vcPayload - Verifiable Credential payload (decoded JWT)
   * @returns Observable<StatusCheckResult>
   */
  public checkCredentialStatus(vcPayload: VcPayload): Observable<StatusCheckResult> {
    try {
      // Extract credentialStatus from VC
      const credentialStatus = vcPayload.credentialStatus || vcPayload.vc?.credentialStatus;

      if (!credentialStatus) {
        // No status list configured - credential is NOT revoked
        return of({
          isRevoked: false,
          statusListUrl: null,
          credentialIndex: null,
          checked: false,
          message: 'No credential status configured'
        });
      }

      // Validate status list format
      if (credentialStatus.type !== 'BitstringStatusListEntry') {
        console.warn('[StatusList] Unsupported status type:', credentialStatus.type);
        return of({
          isRevoked: false,
          statusListUrl: null,
          credentialIndex: null,
          checked: false,
          message: `Unsupported status type: ${credentialStatus.type}`
        });
      }

      const statusListUrl = credentialStatus.statusListCredential;
      const credentialIndex = parseInt(credentialStatus.statusListIndex, 10);

      if (!statusListUrl || isNaN(credentialIndex)) {
        console.warn('[StatusList] Invalid status list configuration');
        return of({
          isRevoked: false,
          statusListUrl: statusListUrl || null,
          credentialIndex: credentialIndex || null,
          checked: false,
          message: 'Invalid status list configuration'
        });
      }

      // Check if we have cached entry
      return from(this.getCachedStatus(statusListUrl, credentialIndex)).pipe(
        switchMap(cachedEntry => {
          if (cachedEntry && !this.isCacheExpired(cachedEntry)) {
            console.log('[StatusList] Using cached status');
            return of({
              isRevoked: cachedEntry.isRevoked,
              statusListUrl: cachedEntry.statusListUrl,
              credentialIndex: cachedEntry.credentialIndex,
              checked: true,
              message: 'Cached result'
            });
          }

          // Fetch status list
          return this.fetchAndCheckStatus(statusListUrl, credentialIndex);
        }),
        catchError(error => {
          console.error('[StatusList] Error checking status:', error);
          // Graceful error handling - don't block validation
          return of({
            isRevoked: false,
            statusListUrl,
            credentialIndex,
            checked: false,
            message: `Error: ${error.message}`
          });
        })
      );
    } catch (error) {
      console.error('[StatusList] Unexpected error:', error);
      return of({
        isRevoked: false,
        statusListUrl: null,
        credentialIndex: null,
        checked: false,
        message: `Unexpected error: ${error}`
      });
    }
  }

  /**
   * Fetch status list and check credential status
   * 
   * @param statusListUrl - URL of the status list credential
   * @param credentialIndex - Index of the credential in the bitstring
   * @returns Observable<StatusCheckResult>
   */
  private fetchAndCheckStatus(
    statusListUrl: string,
    credentialIndex: number
  ): Observable<StatusCheckResult> {
    console.log(`[StatusList] Fetching status list: ${statusListUrl}`);

    return this.http.get<StatusListCredential>(statusListUrl, {
      headers: {
        'Accept': 'application/vc+ld+json, application/json'
      }
    }).pipe(
      map(statusListCredential => {
        // Extract bitstring from status list credential
        const bitstring = this.extractBitstring(statusListCredential);

        // Check if credential is revoked
        const isRevoked = this.checkBit(bitstring, credentialIndex);

        // Cache result
        this.cacheStatus(statusListUrl, credentialIndex, isRevoked);

        return {
          isRevoked,
          statusListUrl,
          credentialIndex,
          checked: true,
          message: isRevoked ? 'Credential is revoked' : 'Credential is valid'
        };
      }),
      catchError(error => {
        console.error(`[StatusList] Failed to fetch status list:`, error);
        throw new StatusListError('Failed to fetch status list', error);
      })
    );
  }

  /**
   * Extract bitstring from status list credential
   * 
   * @param statusListCredential - Status list credential
   * @returns Bitstring (base64url encoded)
   */
  private extractBitstring(statusListCredential: StatusListCredential): string {
    // Try different locations for bitstring
    const credentialSubject = statusListCredential.credentialSubject;

    if (!credentialSubject) {
      throw new StatusListError('No credentialSubject in status list credential');
    }

    const bitstring = credentialSubject.encodedList;

    if (!bitstring) {
      throw new StatusListError('No encodedList found in status list credential');
    }

    return bitstring;
  }

  /**
   * Check if a bit is set in the bitstring
   * 
   * @param bitstring - Base64url encoded bitstring
   * @param index - Index to check
   * @returns true if bit is set (revoked), false otherwise
   */
  private checkBit(bitstring: string, index: number): boolean {
    try {
      // Decode base64url to binary
      const decoded = this.base64UrlDecode(bitstring);

      // Calculate byte and bit position
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;

      if (byteIndex >= decoded.length) {
        throw new StatusListError(`Index ${index} out of bounds for bitstring length ${decoded.length * 8}`);
      }

      // Check if bit is set
      const byte = decoded[byteIndex];
      const bitMask = 1 << (7 - bitIndex); // MSB first
      const isSet = (byte & bitMask) !== 0;

      return isSet;
    } catch (error) {
      console.error('[StatusList] Error checking bit:', error);
      throw new StatusListError('Failed to check bit in bitstring', error);
    }
  }

  /**
   * Decode base64url string to Uint8Array
   * 
   * @param base64url - Base64url encoded string
   * @returns Uint8Array
   */
  private base64UrlDecode(base64url: string): Uint8Array {
    // Convert base64url to base64
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    // Decode base64 to binary string
    const binaryString = atob(base64);

    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
  }

  /**
   * Get cached status entry
   * 
   * @param statusListUrl - Status list URL
   * @param credentialIndex - Credential index
   * @returns Promise<StatusListEntry | null>
   */
  private async getCachedStatus(
    statusListUrl: string,
    credentialIndex: number
  ): Promise<StatusListEntry | null> {
    try {
      const entry = await firstValueFrom(
        this.storage.getStatusListEntry(statusListUrl, credentialIndex)
      );
      return entry;
    } catch (error) {
      console.error('[StatusList] Error getting cached status:', error);
      return null;
    }
  }

  /**
   * Cache status check result
   * 
   * @param statusListUrl - Status list URL
   * @param credentialIndex - Credential index
   * @param isRevoked - Revocation status
   */
  private async cacheStatus(
    statusListUrl: string,
    credentialIndex: number,
    isRevoked: boolean
  ): Promise<void> {
    try {
      const entry: StatusListEntry = {
        statusListUrl,
        credentialIndex,
        isRevoked,
        lastCheckedAt: new Date().toISOString(),
        cacheTtlSeconds: StatusListService.CACHE_TTL_SECONDS
      };

      await firstValueFrom(this.storage.saveStatusListEntry(entry));
    } catch (error) {
      console.error('[StatusList] Error caching status:', error);
      // Non-critical error - don't throw
    }
  }

  /**
   * Check if cache entry is expired
   * 
   * @param entry - Cached entry
   * @returns true if expired
   */
  private isCacheExpired(entry: StatusListEntry): boolean {
    const lastChecked = new Date(entry.lastCheckedAt).getTime();
    const now = new Date().getTime();
    const ageSeconds = (now - lastChecked) / 1000;
    
    return ageSeconds > entry.cacheTtlSeconds;
  }

  /**
   * Clear status list cache
   * 
   * @returns Observable<boolean>
   */
  public clearCache(): Observable<boolean> {
    // In production, you'd want a method to clear only status list cache
    // For now, this is a placeholder
    console.log('[StatusList] Cache clear requested');
    return of(true);
  }
}

/**
 * VC Payload structure (simplified)
 */
interface VcPayload {
  credentialStatus?: CredentialStatus;
  vc?: {
    credentialStatus?: CredentialStatus;
  };
  [key: string]: unknown;
}

/**
 * Credential Status structure
 */
interface CredentialStatus {
  type: string;
  statusListCredential: string;
  statusListIndex: string;
}

/**
 * Status List Credential structure
 */
interface StatusListCredential {
  '@context': string | string[];
  id: string;
  type: string | string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: {
    type: string;
    statusPurpose: string;
    encodedList: string; // Base64url encoded bitstring
  };
}

/**
 * Status Check Result
 */
export interface StatusCheckResult {
  /** Whether credential is revoked */
  isRevoked: boolean;
  
  /** Status list URL (null if not configured) */
  statusListUrl: string | null;
  
  /** Credential index in status list (null if not configured) */
  credentialIndex: number | null;
  
  /** Whether status was successfully checked */
  checked: boolean;
  
  /** Additional message */
  message: string;
}

/**
 * Status List Error
 */
export class StatusListError extends Error {
  public constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'StatusListError';
  }
}
