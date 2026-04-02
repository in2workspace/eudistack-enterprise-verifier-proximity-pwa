import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { of } from 'rxjs';
import { TrustedIssuer, IssuerStatus } from '../models/trusted-issuer.model';

/**
 * StorageService Tests
 * 
 * Note: These tests use mocked NgxIndexedDBService.
 * For comprehensive testing, use the Phase 1 Demo page in a browser.
 */
describe('StorageService', () => {
  let service: StorageService;
  let mockDbService: any;

  beforeEach(() => {
    mockDbService = {
      add: jest.fn(),
      getByKey: jest.fn(),
      getAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      count: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        StorageService,
        { provide: NgxIndexedDBService, useValue: mockDbService }
      ]
    });

    service = TestBed.inject(StorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Trust Framework Operations', () => {
    const mockIssuer: TrustedIssuer = {
      issuerId: 'did:web:issuer.example.com',
      name: 'Test Issuer',
      credentialTypes: ['EmployeeCredential'],
      trustLevel: 3,
      status: IssuerStatus.ACTIVE,
      lastUpdated: new Date().toISOString()
    };

    it('should save trusted issuer', (done) => {
      mockDbService.add.mockResolvedValue(1);

      service.saveTrustedIssuer(mockIssuer).subscribe(issuer => {
        expect(issuer).toEqual(mockIssuer);
        expect(mockDbService.add).toHaveBeenCalled();
        done();
      });
    });

    it('should get trusted issuer by ID', (done) => {
      mockDbService.getByKey.mockResolvedValue(mockIssuer);

      service.getTrustedIssuer('did:web:issuer.example.com').subscribe(issuer => {
        expect(issuer).toEqual(mockIssuer);
        done();
      });
    });

    it('should return null when issuer not found', (done) => {
      mockDbService.getByKey.mockResolvedValue(undefined);

      service.getTrustedIssuer('nonexistent').subscribe(issuer => {
        expect(issuer).toBeNull();
        done();
      });
    });

    it('should get all trusted issuers', (done) => {
      const issuers = [mockIssuer];
      mockDbService.getAll.mockResolvedValue(issuers);

      service.getAllTrustedIssuers().subscribe(result => {
        expect(result).toEqual(issuers);
        done();
      });
    });

    it('should clear trust framework', (done) => {
      mockDbService.clear.mockResolvedValue(true);

      service.clearTrustFramework().subscribe(result => {
        expect(result).toBe(true);
        done();
      });
    });
  });

  describe('Database Info', () => {
    it('should check if IndexedDB is available', () => {
      const isAvailable = service.isAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should get database statistics', async () => {
      mockDbService.count.mockReturnValueOnce(of(5))
                          .mockReturnValueOnce(of(10))
                          .mockReturnValueOnce(of(3));

      const stats = await service.getDatabaseStats();

      expect(stats.trustFrameworkCount).toBe(5);
      expect(stats.validationLogsCount).toBe(10);
      expect(stats.statusListCacheCount).toBe(3);
      expect(typeof stats.isAvailable).toBe('boolean');
    });
  });
});
