import { TestBed } from '@angular/core/testing';
import { VerifierIdentityService } from './verifier-identity.service';
import { CryptoService } from './crypto.service';

describe('VerifierIdentityService', () => {
  let service: VerifierIdentityService;
  let cryptoService: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VerifierIdentityService, CryptoService]
    });
    service = TestBed.inject(VerifierIdentityService);
    cryptoService = TestBed.inject(CryptoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate identity on first call', async () => {
    const identity = await service.getIdentity();
    
    expect(identity).toBeDefined();
    expect(identity.clientId).toBeDefined();
    expect(identity.clientId).toMatch(/^did:key:z[1-9A-HJ-NP-Za-km-z]+$/);
    expect(identity.keypair).toBeDefined();
    expect(identity.keypair.publicKey).toBeDefined();
    expect(identity.keypair.privateKey).toBeDefined();
  });

  it('should cache identity across calls', async () => {
    const identity1 = await service.getIdentity();
    const identity2 = await service.getIdentity();
    
    expect(identity1.clientId).toBe(identity2.clientId);
    expect(identity1.keypair).toBe(identity2.keypair);
  });

  it('should return clientId directly', async () => {
    const clientId = await service.getClientId();
    
    expect(clientId).toMatch(/^did:key:z[1-9A-HJ-NP-Za-km-z]+$/);
  });

  it('should return "did" as clientIdScheme', () => {
    const scheme = service.getClientIdScheme();
    
    expect(scheme).toBe('did');
  });

  it('should return keypair directly', async () => {
    const keypair = await service.getKeyPair();
    
    expect(keypair).toBeDefined();
    expect(keypair.publicKey).toBeDefined();
    expect(keypair.privateKey).toBeDefined();
  });

  it('should reset identity', async () => {
    const identity1 = await service.getIdentity();
    
    service.reset();
    
    const identity2 = await service.getIdentity();
    
    // After reset, should generate new identity
    expect(identity2.clientId).not.toBe(identity1.clientId);
  });

  it('should handle concurrent calls during initialization', async () => {
    // Call getIdentity multiple times concurrently
    const promises = [
      service.getClientId(),
      service.getClientId(),
      service.getClientId()
    ];
    
    const clientIds = await Promise.all(promises);
    
    // All should return the same clientId (no duplicate generation)
    expect(clientIds[0]).toBe(clientIds[1]);
    expect(clientIds[1]).toBe(clientIds[2]);
  });
});
