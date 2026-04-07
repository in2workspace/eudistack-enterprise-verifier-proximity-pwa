import { Injectable, inject } from '@angular/core';
import { NgxIndexedDBService, ObjectStoreMeta } from 'ngx-indexed-db';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { TrustedIssuer } from '../models/trusted-issuer.model';
import { ValidatedPresentation } from '../models/validated-presentation.model';
import { StatusListEntry } from '../models/status-list-entry.model';

/**
 * Storage Service
 * 
 * Wrapper for IndexedDB using ngx-indexed-db library.
 * Provides CRUD operations for trust framework, validation logs, and status list cache.
 * 
 * Database schema:
 * - trust_framework: Store trusted issuers
 * - validation_logs: Store validation history
 * - status_list_cache: Cache credential revocation status
 * 
 * @service
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly DB_NAME = 'verifier_db';
  private readonly DB_VERSION = 1;

  // Dependencies
  private readonly dbService = inject(NgxIndexedDBService);
  
  // Object store names
  private readonly TRUST_FRAMEWORK_STORE = 'trust_framework';
  private readonly VALIDATION_LOGS_STORE = 'validation_logs';
  private readonly STATUS_LIST_CACHE_STORE = 'status_list_cache';

  // ============================================================
  // Trust Framework Operations
  // ============================================================

  /**
   * Add or update a trusted issuer
   */
  public saveTrustedIssuer(issuer: TrustedIssuer): Observable<TrustedIssuer> {
    return from(
      this.dbService.getByKey<TrustedIssuer>(this.TRUST_FRAMEWORK_STORE, issuer.issuerId)
    ).pipe(
      switchMap(existingIssuer => {
        if (existingIssuer) {
          return from(this.dbService.update(this.TRUST_FRAMEWORK_STORE, issuer));
        } else {
          return from(this.dbService.add(this.TRUST_FRAMEWORK_STORE, issuer));
        }
      }),
      map(() => issuer),
      catchError(error => {
        console.error('Error saving trusted issuer:', error);
        throw new StorageError('Failed to save trusted issuer', error);
      })
    );
  }

  /**
   * Get trusted issuer by ID
   */
  public getTrustedIssuer(issuerId: string): Observable<TrustedIssuer | null> {
    return from(
      this.dbService.getByKey<TrustedIssuer>(this.TRUST_FRAMEWORK_STORE, issuerId)
    ).pipe(
      map(issuer => issuer ?? null),
      catchError(error => {
        console.error('Error getting trusted issuer:', error);
        return of(null);
      })
    );
  }

  /**
   * Get all trusted issuers
   */
  public getAllTrustedIssuers(): Observable<TrustedIssuer[]> {
    return from(
      this.dbService.getAll<TrustedIssuer>(this.TRUST_FRAMEWORK_STORE)
    ).pipe(
      catchError(error => {
        console.error('Error getting all trusted issuers:', error);
        return of([]);
      })
    );
  }

  /**
   * Update trusted issuer
   */
  public updateTrustedIssuer(issuer: TrustedIssuer): Observable<TrustedIssuer> {
    return from(
      this.dbService.update(this.TRUST_FRAMEWORK_STORE, issuer)
    ).pipe(
      map(() => issuer),
      catchError(error => {
        console.error('Error updating trusted issuer:', error);
        throw new StorageError('Failed to update trusted issuer', error);
      })
    );
  }

  /**
   * Delete trusted issuer
   */
  public deleteTrustedIssuer(issuerId: string): Observable<boolean> {
    return from(
      this.dbService.delete(this.TRUST_FRAMEWORK_STORE, issuerId)
    ).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error deleting trusted issuer:', error);
        return of(false);
      })
    );
  }

  /**
   * Clear all trusted issuers
   */
  public clearTrustFramework(): Observable<boolean> {
    return from(
      this.dbService.clear(this.TRUST_FRAMEWORK_STORE)
    ).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error clearing trust framework:', error);
        return of(false);
      })
    );
  }

  // ============================================================
  // Validation Logs Operations
  // ============================================================

  /**
   * Save validation log
   */
  public saveValidationLog(log: ValidatedPresentation): Observable<ValidatedPresentation> {
    return from(
      this.dbService.add(this.VALIDATION_LOGS_STORE, log)
    ).pipe(
      map(() => log),
      catchError(error => {
        console.error('Error saving validation log:', error);
        throw new StorageError('Failed to save validation log', error);
      })
    );
  }

  /**
   * Get validation log by session ID
   */
  public getValidationLog(sessionId: string): Observable<ValidatedPresentation | null> {
    return from(
      this.dbService.getByKey<ValidatedPresentation>(this.VALIDATION_LOGS_STORE, sessionId)
    ).pipe(
      map(log => log ?? null),
      catchError(error => {
        console.error('Error getting validation log:', error);
        return of(null);
      })
    );
  }

  /**
   * Get all validation logs
   */
  public getAllValidationLogs(): Observable<ValidatedPresentation[]> {
    return from(
      this.dbService.getAll<ValidatedPresentation>(this.VALIDATION_LOGS_STORE)
    ).pipe(
      catchError(error => {
        console.error('Error getting all validation logs:', error);
        return of([]);
      })
    );
  }

  /**
   * Delete validation log
   */
  public deleteValidationLog(sessionId: string): Observable<boolean> {
    return from(
      this.dbService.delete(this.VALIDATION_LOGS_STORE, sessionId)
    ).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error deleting validation log:', error);
        return of(false);
      })
    );
  }

  /**
   * Clear all validation logs
   */
  public clearValidationLogs(): Observable<boolean> {
    return from(
      this.dbService.clear(this.VALIDATION_LOGS_STORE)
    ).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error clearing validation logs:', error);
        return of(false);
      })
    );
  }

  // ============================================================
  // Status List Cache Operations
  // ============================================================

  /**
   * Save or update status list entry to cache (upsert)
   * 
   * Uses update if entry exists, add if new.
   * This allows cache refreshes without errors.
   */
  public saveStatusListEntry(entry: StatusListEntry): Observable<StatusListEntry> {
    const key = `${entry.statusListUrl}:${entry.credentialIndex}`;
    const entryWithKey = { ...entry, id: key };
    
    return from(
      this.dbService.getByKey<StatusListEntry>(this.STATUS_LIST_CACHE_STORE, key)
    ).pipe(
      switchMap(existingEntry => {
        if (existingEntry) {
          // Entry exists, update it
          return from(
            this.dbService.update(this.STATUS_LIST_CACHE_STORE, entryWithKey)
          );
        } else {
          // Entry doesn't exist, add it
          return from(
            this.dbService.add(this.STATUS_LIST_CACHE_STORE, entryWithKey)
          );
        }
      }),
      map(() => entry),
      catchError(error => {
        console.error('Error saving status list entry:', error);
        throw new StorageError('Failed to save status list entry', error);
      })
    );
  }

  /**
   * Get cached status list entry
   */
  public getStatusListEntry(
    statusListUrl: string,
    credentialIndex: number
  ): Observable<StatusListEntry | null> {
    const key = `${statusListUrl}:${credentialIndex}`;
    
    return from(
      this.dbService.getByKey<StatusListEntry>(this.STATUS_LIST_CACHE_STORE, key)
    ).pipe(
      map(entry => {
        if (!entry) {
          return null;
        }

        // Check if cache entry is still valid
        const now = new Date().getTime();
        const lastChecked = new Date(entry.lastCheckedAt).getTime();
        const ttlMs = entry.cacheTtlSeconds * 1000;

        if (now - lastChecked > ttlMs) {
          // Cache expired
          return null;
        }

        return entry;
      }),
      catchError(error => {
        console.error('Error getting status list entry:', error);
        return of(null);
      })
    );
  }

  /**
   * Clear status list cache
   */
  public clearStatusListCache(): Observable<boolean> {
    return from(
      this.dbService.clear(this.STATUS_LIST_CACHE_STORE)
    ).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error clearing status list cache:', error);
        return of(false);
      })
    );
  }

  // ============================================================
  // Database Info
  // ============================================================

  /**
   * Check if IndexedDB is available
   */
  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * Get database statistics
   */
  public async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      const trustCount = await this.dbService.count(this.TRUST_FRAMEWORK_STORE).toPromise();
      const logsCount = await this.dbService.count(this.VALIDATION_LOGS_STORE).toPromise();
      const cacheCount = await this.dbService.count(this.STATUS_LIST_CACHE_STORE).toPromise();

      return {
        trustFrameworkCount: trustCount ?? 0,
        validationLogsCount: logsCount ?? 0,
        statusListCacheCount: cacheCount ?? 0,
        isAvailable: this.isAvailable()
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {
        trustFrameworkCount: 0,
        validationLogsCount: 0,
        statusListCacheCount: 0,
        isAvailable: false
      };
    }
  }
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  trustFrameworkCount: number;
  validationLogsCount: number;
  statusListCacheCount: number;
  isAvailable: boolean;
}

/**
 * Storage error class
 */
export class StorageError extends Error {
  public constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * IndexedDB configuration for ngx-indexed-db
 * 
 * Object store definitions:
 * - trust_framework: keyPath = 'issuerId'
 * - validation_logs: keyPath = 'sessionId'
 * - status_list_cache: keyPath = 'id' (composite: url:index)
 */
export const DB_CONFIG: ObjectStoreMeta[] = [
  {
    store: 'trust_framework',
    storeConfig: { keyPath: 'issuerId', autoIncrement: false },
    storeSchema: [
      { name: 'issuerId', keypath: 'issuerId', options: { unique: true } },
      { name: 'name', keypath: 'name', options: { unique: false } },
      { name: 'status', keypath: 'status', options: { unique: false } },
      { name: 'trustLevel', keypath: 'trustLevel', options: { unique: false } }
    ]
  },
  {
    store: 'validation_logs',
    storeConfig: { keyPath: 'sessionId', autoIncrement: false },
    storeSchema: [
      { name: 'sessionId', keypath: 'sessionId', options: { unique: true } },
      { name: 'submittedAt', keypath: 'submittedAt', options: { unique: false } }
    ]
  },
  {
    store: 'status_list_cache',
    storeConfig: { keyPath: 'id', autoIncrement: false },
    storeSchema: [
      { name: 'id', keypath: 'id', options: { unique: true } },
      { name: 'statusListUrl', keypath: 'statusListUrl', options: { unique: false } },
      { name: 'lastCheckedAt', keypath: 'lastCheckedAt', options: { unique: false } }
    ]
  }
];
