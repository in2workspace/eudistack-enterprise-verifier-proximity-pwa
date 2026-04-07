import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { TrustedIssuer, IssuerStatus } from '../models/trusted-issuer.model';
import { TrustFrameworkJson, TrustFrameworkMetadata } from '../models/trust-framework-config.model';
import { TrustFrameworkError } from '../errors/trust-framework.error';
import { StorageService } from './storage.service';

/**
 * Trust Framework Service
 * 
 * Manages the trust framework for credential verification.
 * 
 * Features:
 * - Load trusted issuers from JSON file
 * - Synchronize to IndexedDB for offline access
 * - Query issuer trust status
 * - Support for trust levels and credential type filtering
 * - eIDAS issuer identification
 * 
 * Lifecycle:
 * 1. App startup → loadTrustFramework()
 * 2. JSON → IndexedDB synchronization
 * 3. Runtime queries use IndexedDB (fast, offline-capable)
 * 
 * @service
 * @injectable
 */
@Injectable({
  providedIn: 'root'
})
export class TrustFrameworkService {
  private readonly TRUST_FRAMEWORK_PATH = '/assets/trust-framework/trusted-issuers.json';
  
  // Dependencies
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  
  // Trust framework loaded state (signal) //TODO: Check if this is needed
  private readonly loadedSignal = signal<boolean>(false);
  public readonly loaded$ = toObservable(this.loadedSignal);
  public readonly isLoaded = computed(() => this.loadedSignal());

  // Trust framework metadata (signal) //TODO: Check if this is needed
  private readonly metadataSignal = signal<TrustFrameworkMetadata | null>(null);
  public readonly metadata$ = toObservable(this.metadataSignal);
  public readonly metadata = computed(() => this.metadataSignal());

  /**
   * Load trust framework from JSON file
   * 
   * Should be called on app startup (e.g., in APP_INITIALIZER).
   * Loads trusted issuers from JSON and synchronizes to IndexedDB.
   * 
   * @returns Promise that resolves when loading is complete
   */
  public async loadTrustFramework(): Promise<void> {
    try {
      console.log('[TrustFramework] Loading trust framework...');

      // Fetch trust framework JSON
      const trustFramework = await firstValueFrom(
        this.http.get<TrustFrameworkJson>(this.TRUST_FRAMEWORK_PATH)
      );

      console.log(`[TrustFramework] Loaded ${trustFramework.trustedIssuers.length} trusted issuers`);

      // Clear existing trust framework in DB
      await firstValueFrom(this.storage.clearTrustFramework());

      // Save issuers to IndexedDB
      const savePromises = trustFramework.trustedIssuers.map(issuer =>
        firstValueFrom(this.storage.saveTrustedIssuer(issuer))
      );

      await Promise.all(savePromises);

      // Update metadata
      this.metadataSignal.set({
        version: trustFramework.version,
        lastUpdated: trustFramework.lastUpdated,
        totalIssuers: trustFramework.metadata?.totalIssuers ?? trustFramework.trustedIssuers.length,
        activeIssuers: trustFramework.metadata?.activeIssuers ?? 
          trustFramework.trustedIssuers.filter(i => i.status === IssuerStatus.ACTIVE).length,
        eidasIssuers: trustFramework.metadata?.eidasIssuers ?? 
          trustFramework.trustedIssuers.filter(i => i.isEidas).length
      });

      // Mark as loaded
      this.loadedSignal.set(true);

      console.log('[TrustFramework] Trust framework loaded successfully');
    } catch (error) {
      console.error('[TrustFramework] Failed to load trust framework:', error);
      this.loadedSignal.set(false);
      throw new TrustFrameworkError('Failed to load trust framework', error);
    }
  }

  /**
   * Check if an issuer is trusted
   * 
   * @param issuerId - Issuer DID (e.g., "did:web:issuer.example.com")
   * @returns Observable<boolean> - true if issuer is trusted and active
   */
  public isTrustedIssuer(issuerId: string): Observable<boolean> {
    this.ensureLoaded();

    return this.storage.getTrustedIssuer(issuerId).pipe(
      map(issuer => {
        if (!issuer) {
          return false;
        }

        // Check if issuer is active
        return issuer.status === IssuerStatus.ACTIVE;
      }),
      catchError(error => {
        console.error(`[TrustFramework] Error checking issuer ${issuerId}:`, error);
        return of(false);
      })
    );
  }

  /**
   * Get trusted issuer details
   * 
   * @param issuerId - Issuer DID
   * @returns Observable<TrustedIssuer | null> - Issuer details or null if not found
   */
  public getTrustedIssuer(issuerId: string): Observable<TrustedIssuer | null> {
    this.ensureLoaded();

    return this.storage.getTrustedIssuer(issuerId).pipe(
      catchError(error => {
        console.error(`[TrustFramework] Error getting issuer ${issuerId}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Get all trusted issuers
   * 
   * @param activeOnly - Return only active issuers (default: true)
   * @returns Observable<TrustedIssuer[]>
   */
  public getAllTrustedIssuers(activeOnly: boolean = true): Observable<TrustedIssuer[]> {
    this.ensureLoaded();

    return this.storage.getAllTrustedIssuers().pipe(
      map(issuers => {
        if (activeOnly) {
          return issuers.filter(issuer => issuer.status === IssuerStatus.ACTIVE);
        }
        return issuers;
      }),
      catchError(error => {
        console.error('[TrustFramework] Error getting all issuers:', error);
        return of([]);
      })
    );
  }

  /**
   * Get trusted issuers by credential type
   * 
   * @param credentialType - Credential type (e.g., "LEARCredentialEmployee")
   * @returns Observable<TrustedIssuer[]> - Issuers that support this credential type
   */
  public getTrustedIssuersForCredentialType(credentialType: string): Observable<TrustedIssuer[]> {
    return this.getAllTrustedIssuers(true).pipe(
      map(issuers => 
        issuers.filter(issuer => 
          issuer.credentialTypes.includes(credentialType)
        )
      )
    );
  }

  /**
   * Get eIDAS issuers only
   * 
   * @returns Observable<TrustedIssuer[]> - eIDAS-compliant issuers
   */
  public getEidasIssuers(): Observable<TrustedIssuer[]> {
    return this.getAllTrustedIssuers(true).pipe(
      map(issuers => issuers.filter(issuer => issuer.isEidas))
    );
  }

  /**
   * Get issuers by trust level
   * 
   * @param minTrustLevel - Minimum trust level (1-5)
   * @returns Observable<TrustedIssuer[]> - Issuers with trust level >= minTrustLevel
   */
  public getIssuersByTrustLevel(minTrustLevel: number): Observable<TrustedIssuer[]> {
    return this.getAllTrustedIssuers(true).pipe(
      map(issuers => 
        issuers.filter(issuer => issuer.trustLevel >= minTrustLevel)
      )
    );
  }

  /**
   * Get trust framework metadata
   * 
   * @returns TrustFrameworkMetadata | null
   * @deprecated Use metadata() signal instead
   */
  public getMetadata(): TrustFrameworkMetadata | null {
    return this.metadataSignal();
  }

  /**
   * Refresh trust framework
   * 
   * Reloads the trust framework from JSON file.
   * Useful for manual refresh or after updates.
   * 
   * @returns Promise<void>
   */
  public async refreshTrustFramework(): Promise<void> {
    console.log('[TrustFramework] Refreshing trust framework...');
    this.loadedSignal.set(false);
    await this.loadTrustFramework();
  }

  /**
   * Ensure trust framework is loaded
   * 
   * @throws {TrustFrameworkError} If trust framework is not loaded
   */
  private ensureLoaded(): void {
    if (!this.loadedSignal()) {
      throw new TrustFrameworkError(
        'Trust framework not loaded. Call loadTrustFramework() first.'
      );
    }
  }
}
