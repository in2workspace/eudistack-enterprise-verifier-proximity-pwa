# FASE 1 - API Integration

## ✅ Implementación Completada

La PWA Verifier Proximity ahora consume el backend `eudistack-core-verifier` vía OAuth2 + OID4VP + SSE, siguiendo **exactamente el mismo flujo que el MFE Login**.

### Servicios Implementados

| Servicio | Responsabilidad | Archivo |
|----------|----------------|---------|
| **VerifierApiService** | HTTP client para backend | [verifier-api.service.ts](src/app/core/services/verifier-api.service.ts) |
| **SseListenerService** | Server-Sent Events listener | [sse-listener.service.ts](src/app/core/services/sse-listener.service.ts) |
| **QrGenerationService** | Gestión de QR codes | [qr-generation.service.ts](src/app/core/services/qr-generation.service.ts) |
| **VerificationFlowService** | Orquestador del flujo completo | [verification-flow.service.ts](src/app/core/services/verification-flow.service.ts) |
| **errorInterceptor** | Manejo centralizado de errores HTTP | [error.interceptor.ts](src/app/core/interceptors/error.interceptor.ts) |

### Endpoints del Backend Consumidos

```
GET  /oidc/authorize                 → Inicia flujo OAuth2/OIDC (endpoint principal)
GET  /oid4vp/auth-request/{nonce}    → Wallet descarga el Authorization Request JWT
POST /oid4vp/auth-response           → Wallet envía VP (wallet → backend directo)
GET  /api/login/events?state={state} → SSE para notificaciones de verificación
```

### Flujo de Verificación (OAuth2 + OID4VP + SSE)

**El mismo flujo que MFE Login**, actuando como cliente OAuth2 del Verifier Core:

```
┌─────────────┐         ┌──────────────────┐         ┌────────────┐
│ Verifier PWA│────1───▶│  Verifier Core   │◀───3───│   Wallet   │
│ (OAuth2     │◀───2────│    (Backend)     │         │   (EUDIW)  │
│  Client)    │         └──────────────────┘         └────────────┘
│             │                  │                          │
│             │◀─────────4───────┘                          │
│             │         (SSE)                               │
└─────────────┘                                             │

1. PWA inicia flujo OAuth2:
   GET /oidc/authorize
     ?client_id=proximity-verifier-pwa
     &redirect_uri=https://verifier-pwa.example.com/login
     &response_type=code
     &scope=openid learcredential
     &state={uuid}

2. Backend genera Authorization Request JWT y redirige:
   → /login?authRequest=openid4vp://...&state={uuid}&homeUri=...
   
   Dentro del authRequest (openid4vp://):
   - client_id: DID del Verifier
   - request_uri: https://verifier.example.com/oid4vp/auth-request/{nonce}
   
   El JWT en request_uri contiene:
   - dcql_query (credenciales solicitadas)
   - response_uri (/oid4vp/auth-response)
   - client_metadata

3. PWA muestra QR + subscribe SSE:
   - QR: authRequest (URL openid4vp://)
   - SSE: GET /api/login/events?state={uuid}
   
   Wallet escanea QR:
   a) GET /oid4vp/auth-request/{nonce} → obtiene JWT firmado
   b) Procesa dcql_query
   c) POST /oid4vp/auth-response → envía vp_token

4. Backend valida VP y emite evento SSE:
   event: redirect
   data: {redirectUrl}
   
   PWA recibe evento → muestra resultado

---

## Información Requerida por el Verifier para Generar el QR

El Verifier **NO crea el QR directamente**. La PWA solo recibe la **URL openid4vp://** y la renderiza.

### ¿Qué envía el backend a la PWA?

Cuando el backend recibe `GET /oidc/authorize`, genera:

1. **Authorization Request JWT (OID4VP)** firmado que contiene:
   ```json
   {
     "iss": "did:key:zDnaeTMKbfns...",
     "aud": "https://self-issued.me/v2",
     "client_id": "did:key:zDnaeTMKbfns...",
     "nonce": "uuid-v4",
     "response_uri": "https://verifier.example.com/oid4vp/auth-response",
     "scope": "openid learcredential.employee",
     "state": "oauth2-state",
     "response_type": "vp_token",
     "response_mode": "direct_post",
     "dcql_query": {
       "credentials": [{
         "id": "learcredential_employee",
         "format": "jwt_vc_json",
         "meta": { "vct_values": ["LEARCredentialEmployee"] },
         "claims": [
           { "path": ["mandate.mandatee.email"] },
           { "path": ["mandate.mandatee.first_name"] }
         ]
       }]
     },
     "client_metadata": { ... }
   }
   ```

2. **URL openid4vp://** (el contenido del QR):
   ```
   openid4vp://?client_id=did%3Akey%3A...&request_uri=https%3A%2F%2Fverifier.example.com%2Foid4vp%2Fauth-request%2F{nonce}
   ```

3. **Redirección a la PWA**:
   ```
   https://verifier-pwa.example.com/login
     ?authRequest=openid4vp%3A%2F%2F...
     &state={oauth2-state}
     &homeUri={client_name}
   ```

### ¿Cómo lo recibe la PWA?

La PWA extrae los query parameters:

```typescript
// VerificationPageComponent.ngOnInit()
this.route.queryParams.subscribe(params => {
  const authRequest = params['authRequest']; // URL openid4vp://
  const state = params['state'];             // OAuth2 state (para SSE)
  const homeUri = params['homeUri'];         // Nombre del cliente
  
  if (authRequest && state) {
    this.startCrossDeviceFlow(authRequest, state);
  } else {
    // No authRequest → iniciar flujo OAuth2
    this.initiateOAuth2Flow();
  }
});
```

### ¿Qué hace con el authRequest?

1. **Muestra el QR**:
   ```html
   <qr-code [value]="authRequest"></qr-code>
   ```
   El QR contiene la URL `openid4vp://...` completa

2. **Suscribe a SSE**:
   ```typescript
   this.sseService.subscribe(state).subscribe(event => {
     if (event.type === 'success') {
       this.showSuccess(event.userData);
     }
   });
   ```

3. **Espera a que el wallet escanee y complete el flujo**

---

## Flujo Detallado: Paso a Paso

### 1. Usuario accede a la PWA

```
https://verifier-pwa.example.com/
```

**Componente:** `VerificationPageComponent`  
**Acción:** Detecta que no hay `authRequest` en los query params

### 2. PWA inicia flujo OAuth2

```typescript
// VerificationPageComponent.initiateOAuth2Flow()
const authUrl = `${backendUrl}/oidc/authorize?${params}`;
window.location.href = authUrl;
```

**Request:**
```
GET https://verifier.example.com/oidc/authorize
  ?client_id=proximity-verifier-pwa
  &redirect_uri=https://verifier-pwa.example.com/login
  &response_type=code
  &scope=openid learcredential.employee
  &state=a1b2c3d4-e5f6-...
```

### 3. Backend procesa la petición OAuth2

**Componente backend:** `CustomAuthorizationRequestConverter`  
**Flujo:**
1. Valida `RegisteredClient` (proximity-verifier-pwa debe estar registrado)
2. Llama a `AuthorizationRequestBuildWorkflow.buildAuthorizationRequest()`
3. Genera:
   - Authorization Request JWT firmado
   - URL openid4vp:// con `request_uri`
   - Cachea el JWT en memoria (keyed by qrNonce)

**Response:**
```http
HTTP/1.1 302 Found
Location: https://verifier-pwa.example.com/login
  ?authRequest=openid4vp%3A%2F%2F...
  &state=a1b2c3d4-e5f6-...
  &homeUri=Proximity%20Verifier
```

### 4. PWA recibe la redirección

```typescript
// VerificationPageComponent.ngOnInit()
// this.route.queryParams detecta authRequest + state
this.startCrossDeviceFlow(authRequest, state);
```

**Acciones:**
1. `QrGenerationService.createFromAuthRequest(authRequest, state)`
   - Crea QrData con la URL recibida
   - Extrae sessionId (nonce) de la request_uri
2. `VerificationFlowService.startFromAuthRequest(authRequest, state)`
   - Emite estado 'waiting' con qrData
   - Inicia SseListenerService
3. Renderiza QR en pantalla

### 5. Usuario escanea el QR con su wallet

**Contenido del QR:**
```
openid4vp://?client_id=did%3Akey%3A...&request_uri=https%3A%2F%2Fverifier.example.com%2Foid4vp%2Fauth-request%2F7c3a5b2d...
```

**Wallet procesa:**
1. Extrae `request_uri` de la URL
2. Hace `GET {request_uri}` para obtener el Authorization Request JWT
3. Parsea el JWT y extrae `dcql_query`
4. Solicita al usuario las credenciales requeridas
5. Genera Verifiable Presentation (VP token)
6. Envía VP al backend

### 6. Wallet descarga el Authorization Request JWT

```
GET https://verifier.example.com/oid4vp/auth-request/7c3a5b2d-4e8f-...
```

**Backend:** `Oid4vpController.getAuthorizationRequest()`
- Recupera JWT del cache (keyed by nonce)
- Elimina el cache (one-time use)
- Devuelve JWT firmado

**Response:**
```
eyJhbGciOiJFUzI1NiIsInR5cCI6Im9hdXRoLWF1dGh6LXJlcStqd3QifQ.eyJpc3MiOiJkaWQ6a2V5OnpEbmFlVE1LYmZucyIsImF1ZCI6Imh0dHBzOi8vc2VsZi1pc3N1ZWQubWUvdjIiLCJpYXQiOjE3MTI4ODg4MDAsImV4cCI6MTcxMjg4OTEwMCwiY2xpZW50X2lkIjoiZGlkOmtleTp6RG5hZVRNS2JmbnMiLCJub25jZSI6ImExYjJjM2Q0LWU1ZjYtNGE3Yi04Yzl5LTBkMWUyZjNhNGI1YyIsInJlc3BvbnNlX3VyaSI6Imh0dHBzOi8vdmVyaWZpZXIuZXhhbXBsZS5jb20vb2lkNHZwL2F1dGgtcmVzcG9uc2UiLCJzY29wZSI6Im9wZW5pZCBsZWFyY3JlZGVudGlhbC5lbXBsb3llZSIsInN0YXRlIjoiYTFiMmMzZDQtZTVmNi0uLi4iLCJyZXNwb25zZV90eXBlIjoidnBfdG9rZW4iLCJyZXNwb25zZV9tb2RlIjoiZGlyZWN0X3Bvc3QiLCJkY3FsX3F1ZXJ5Ijp7ImNyZWRlbnRpYWxzIjpbeyJpZCI6ImxlYXJjcmVkZW50aWFsX2VtcGxveWVlIiwiZm9ybWF0Ijoiand0X3ZjX2pzb24iLCJtZXRhIjp7InZjdF92YWx1ZXMiOlsiTEVBUkNyZWRlbnRpYWxFbXBsb3llZSJdfSwiY2xhaW1zIjpbeyJwYXRoIjpbIm1hbmRhdGUubWFuZGF0ZWUuZW1haWwiXX0seyJwYXRoIjpbIm1hbmRhdGUubWFuZGF0ZWUuZmlyc3RfbmFtZSJdfV19XX0sImNsaWVudF9tZXRhZGF0YSI6eyJ2cF9mb3JtYXRzIjp7Imp3dF92cF9qc29uIjp7ImFsZyI6WyJFUzI1NiJdfSwiandsX3ZjX2pzb24iOnsiYWxnIjpbIkVTMjU2Il19fSwiY2xpZW50X25hbWUiOiJQcm94aW1pdHkgVmVyaWZpZXIifX0.MEUCIQDx7...
```

### 7. Wallet envía VP al backend

```http
POST https://verifier.example.com/oid4vp/auth-response
Content-Type: application/x-www-form-urlencoded

state=a1b2c3d4-e5f6-...&vp_token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Backend:** `Oid4vpController.handleAuthResponse()`
1. Valida el VP token (firma, schema, status list)
2. Extrae claims de las credenciales presentadas
3. Genera `authorization_code` OAuth2
4. Emite evento SSE a la PWA

### 8. Backend emite evento SSE a la PWA

**SSE Connection:** PWA ya estaba conectada desde el paso 4

```
GET https://verifier.example.com/api/login/events?state=a1b2c3d4-e5f6-...
```

**Evento emitido por el backend:**
```
event: redirect
data: https://verifier-pwa.example.com/callback?code=...&state=a1b2c3d4-e5f6-...
```

### 9. PWA recibe el evento SSE

```typescript
// SseListenerService
eventSource.addEventListener('redirect', (event: MessageEvent) => {
  const successEvent: LoginEvent = {
    type: 'success',
    redirectUrl: event.data,
    userData: {}
  };
  observer.next(successEvent);
});

// VerificationFlowService procesa el evento
// → Emite estado 'success'

// VerificationPageComponent muestra resultado
this.currentState.set('success');
```

**UI:** Muestra mensaje de éxito y datos del usuario verificado

---

## Configuración

### 1. Backend URL

Configura la URL del backend en `src/assets/env.js`:

```javascript
window["env"] = {
  "verifierBackendUrl": "http://localhost:8081", // Cambiar según entorno
  "sseTimeout": 120000,
  "qrExpirationSeconds": 120,
  "tenant": "altia"
};
```

**Entornos:**
- **Local**: http://localhost:8081
- **Staging**: https://verifier-staging.eudistack.com
- **Production**: https://verifier.eudistack.com

### 2. Registered Client en el Backend

La PWA debe estar registrada como cliente OAuth2 en el backend:

**Configuración requerida en el backend:**
```yaml
# Spring Authorization Server - Registered Clients
spring:
  security:
    oauth2:
      authorizationserver:
        client:
          proximity-verifier-pwa:
            registration:
              client-id: proximity-verifier-pwa
              client-name: "Proximity Verifier PWA"
              client-authentication-methods:
                - none  # Public client (no secret)
              authorization-grant-types:
                - authorization_code
              redirect-uris:
                - https://verifier-pwa.eudistack.com/login
                - http://localhost:4200/login  # Solo dev
              scopes:
                - openid
                - learcredential.employee
              require-authorization-consent: false
```

**Verificación:**
```bash
# El backend debe tener el cliente registrado en RegisteredClientRepository
# Ver: CustomRegisteredClientsTenantConfig.java o similar
```

### 3. CORS del Backend

El backend debe permitir solicitudes desde la PWA:

```yaml
# application.yml (backend)
cors:
  allowed-origins:
    - https://verifier-pwa.eudistack.com
    - http://localhost:4200  # Solo dev
  allowed-methods:
    - GET
    - POST
    - OPTIONS
  allowed-headers:
    - Content-Type
  allow-credentials: true
```

### 4. Proxy Local (Desarrollo)

Si hay problemas de CORS en desarrollo, usar proxy de Angular:

**proxy.conf.json:**
```json
{
  "/oidc": {
    "target": "http://localhost:8081",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  },
  "/oid4vp": {
    "target": "http://localhost:8081",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  },
  "/api/login": {
    "target": "http://localhost:8081",
    "secure": false,
    "changeOrigin": true
  }
}
```

**Ejecutar:**
```bash
ng serve --proxy-config proxy.conf.json
```

---

## Testing

### Unit Tests

```bash
npm test
```

Tests implementados:
- ✅ `verifier-api.service.spec.ts` - HTTP client tests
- ✅ `qr-generation.service.spec.ts` - QR generation tests
- ⏳ `sse-listener.service.spec.ts` - TODO
- ⏳ `verification-flow.service.spec.ts` - TODO

### Manual Testing

1. **Iniciar backend:**
   ```bash
   cd eudistack-core-verifier
   ./gradlew bootRun
   ```

2. **Iniciar PWA:**
   ```bash
   npm start
   ```

3. **Flujo completo:**
   - Acceder a http://localhost:4200
   - PWA redirige automáticamente a `/oidc/authorize`
   - Backend redirige de vuelta con `authRequest`
   - QR se muestra en pantalla
   - Consola del navegador muestra logs de SSE
   - Conexión SSE establecida a `http://localhost:8081/api/login/events?state=...`
   - Escanear QR con wallet de prueba
   - Backend valida VP y emite evento SSE
   - PWA muestra resultado de verificación

### Troubleshooting

**Error: "No se puede conectar con el servidor"**
- Verificar que el backend esté corriendo en `http://localhost:8081`
- Verificar configuración de `verifierBackendUrl` en `env.js`
- Revisar logs del navegador (F12 → Console)
- Verificar que el backend use el puerto correcto (8081 o 8082)

**Error: CORS**
- Verificar configuración CORS del backend
- Usar proxy local en desarrollo (ver arriba)
- Verificar que `allowed-origins` incluya `http://localhost:4200`

**Error: "Client not found" o "Unauthorized client"**
- El cliente OAuth2 `proximity-verifier-pwa` no está registrado en el backend
- Verificar `RegisteredClientRepository` en el backend
- Ver sección "Registered Client en el Backend" arriba

**Error: "Redirect URI mismatch"**
- El `redirect_uri` enviado no coincide con el registrado
- Verificar que `/login` esté en la lista de `redirect-uris` del cliente

**Error: "Sesión no encontrada o expirada"**
- El JWT del Authorization Request ya fue consumido o expiró
- El QR solo es válido para una descarga (one-time use)
- Regenerar QR (timeout: 120s por defecto)

**Error: "SSE timeout"**
- El wallet no completó la presentación en 120 segundos
- PWA cierra la conexión SSE automáticamente
- Regenerar QR y volver a intentar

---

## Similitud con el MFE Login

**La PWA Verifier Proximity sigue EXACTAMENTE el mismo patrón que el MFE Login:**

| Aspecto | MFE Login | Verifier Proximity PWA |
|---------|-----------|------------------------|
| **Rol** | Frontend de login para portales | Frontend de verificación presencial |
| **Backend** | eudistack-core-verifier | eudistack-core-verifier (mismo) |
| **Endpoint OAuth2** | `/oidc/authorize` | `/oidc/authorize` (mismo) |
| **Client ID** | `portal-console` | `proximity-verifier-pwa` |
| **Scope** | `openid learcredential.employee` | `openid learcredential.employee` (mismo) |
| **Redirect** | `/login?authRequest=...&state=...` | `/login?authRequest=...&state=...` (mismo) |
| **QR Content** | URL openid4vp:// del backend | URL openid4vp:// del backend (mismo) |
| **SSE Endpoint** | `/api/login/events?state=...` | `/api/login/events?state=...` (mismo) |
| **SSE Event** | `event: redirect` | `event: redirect` (mismo) |
| **Tecnología** | Angular 19 standalone | Angular 19 + Ionic standalone |
| **Biblioteca QR** | angularx-qrcode | angularx-qrcode (mismo) |

**Diferencias clave:**
- **UX**: MFE Login es para autenticación general, Proximity PWA es para verificación presencial (ej. control de acceso)
- **Post-verificación**: MFE Login redirige al portal, Proximity PWA muestra resultado en pantalla
- **UI**: Proximity PWA usa Ionic para aspecto mobile-first

**Código reutilizable:**
- `SseService` es prácticamente idéntico
- Flujo de `LoginComponent` vs `VerificationPageComponent` es el mismo
- Lógica de manejo de eventos SSE es idéntica

Ver documentación completa del flujo: [mfe-login-verifier-flow.md](../../../eudistack-platform-dev/docs/_shared/architecture/mfe-login-verifier-flow.md)

---

## Cambios Principales (FASE 1)

### Arquitectura OAuth2 + OID4VP

✅ **PWA como cliente OAuth2**
- Redirige a `/oidc/authorize` para iniciar el flujo
- Recibe `authRequest` vía redirección del backend
- Actúa como "dumb client": solo muestra QR + escucha SSE

✅ **Backend como Authorization Server OAuth2**
- Genera Authorization Request JWT (OID4VP)
- Cachea JWT para descarga one-time por el wallet
- Valida VP tokens recibidos del wallet
- Emite eventos SSE con resultados

### Servicios Eliminados (Validación Local)

❌ ValidationService  
❌ TrustFrameworkService  
❌ StatusListService  
❌ CryptoService  
❌ VerifierIdentityService  

**Toda la validación ahora se realiza en el backend.**

### Servicios Nuevos (Integración con Backend)

✅ **VerifierApiService** - HTTP client (opcional, actualmente no usado en OAuth2 flow)
✅ **SseListenerService** - Server-Sent Events (escucha eventos de verificación)
✅ **QrGenerationService** - Recibe authRequest del backend y genera QR data
✅ **VerificationFlowService** - Orquestador del flujo OAuth2 + SSE

### Componentes Actualizados

✅ **VerificationPageComponent**
- Detecta si hay `authRequest` en query params
- Si no hay authRequest → inicia flujo OAuth2 (`/oidc/authorize`)
- Si hay authRequest → muestra QR + suscribe SSE
- Maneja estados: waiting → validating → success/error

### Configuración Actualizada

✅ **main.ts** - Registra errorInterceptor  
✅ **environment.ts** - Configuración de backend  
✅ **assets/env.js** - Runtime config con backend URL  
✅ **Client Registration** - Requiere registro OAuth2 en backend

---

## Diagrama de Componentes

```
┌────────────────────────────────────────────────────────────────┐
│                    Verifier Proximity PWA                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  VerificationPageComponent                                      │
│       │                                                         │
│       ├──> No authRequest? → initiateOAuth2Flow()              │
│       │    window.location.href = "/oidc/authorize?..."        │
│       │                                                         │
│       └──> authRequest received? → startCrossDeviceFlow()      │
│            │                                                    │
│            ├──> VerificationFlowService                        │
│            │    └──> startFromAuthRequest(authRequest, state)  │
│            │         │                                          │
│            │         ├──> QrGenerationService                  │
│            │         │    └─> createFromAuthRequest()          │
│            │         │        Returns: QrData                  │
│            │         │                                          │
│            │         └──> SseListenerService                   │
│            │              └─> subscribe(state)                 │
│            │                  EventSource(/api/login/events)   │
│            │                  Listens for 'redirect' event     │
│            │                                                    │
│            └──> QRDisplayComponent                             │
│                 <qr-code [value]="authRequest"></qr-code>      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                     Verifier Core Backend                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /oidc/authorize                                            │
│       │                                                         │
│       ▼                                                         │
│  CustomAuthorizationRequestConverter                            │
│       │                                                         │
│       ├──> Valida RegisteredClient (proximity-verifier-pwa)    │
│       │                                                         │
│       ▼                                                         │
│  AuthorizationRequestBuildWorkflow                              │
│       │                                                         │
│       ├──> DcqlProfileResolver.resolve(scope)                  │
│       │    Returns: DCQL query                                 │
│       │                                                         │
│       ├──> JWTService.issueJWTwithOI4VPType(payload)           │
│       │    └──> CryptoComponent.sign(JWT)                      │
│       │                                                         │
│       ├──> CacheStore.add(qrNonce, AuthorizationRequestJWT)    │
│       │    (One-time use cache)                                │
│       │                                                         │
│       └──> Returns:                                             │
│            - signedAuthRequestJwt                               │
│            - openid4vpUrl (para QR)                             │
│            - qrNonce                                            │
│            - homeUri                                            │
│                                                                 │
│  Redirect 302 → /login?authRequest={url}&state=...             │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /oid4vp/auth-request/{qrNonce}                             │
│       │                                                         │
│       ├──> CacheStore.get(qrNonce)                             │
│       ├──> CacheStore.delete(qrNonce) ← One-time use           │
│       └──> Returns: signed JWT                                 │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/login/events?state={state}                            │
│       │                                                         │
│       └──> SseEmitterStore.create(state, timeoutMs)            │
│            └──> Returns: Server-Sent Events stream             │
│                 Waits for auth-response completion             │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /oid4vp/auth-response                                     │
│       │      (from Wallet)                                      │
│       │                                                         │
│       ├──> AuthorizationResponseProcessorService               │
│       │    ├──> Valida VP token (firma, schema, status)        │
│       │    ├──> Extrae claims                                  │
│       │    ├──> Genera authorization_code                      │
│       │    └──> SseEmitterStore.emit(state, redirectUrl)       │
│       │                                                         │
│       └──> Returns: 200 OK                                     │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Próximos Pasos (FASE 2)

- [ ] Implementar ErrorDisplayComponent mejorado
- [ ] Completar tests E2E
- [ ] Implementar Service Worker para offline
- [ ] Performance optimization
- [ ] Security audit
- [ ] Integración con backend de verificación empresarial (eudistack-enterprise-verifier)
- [ ] Soporte para múltiples tipos de credenciales
- [ ] Analytics y telemetría

---

## Referencias

- **Flujo detallado**: [mfe-login-verifier-flow.md](../../../eudistack-platform-dev/docs/_shared/architecture/mfe-login-verifier-flow.md)
- **ROADMAP**: [docs/EUDI-024-verifier-proximity-pwa/ROADMAP.md](../../eudistack-platform-dev/docs/EUDI-024-verifier-proximity-pwa/ROADMAP.md)
- **Backend**: `eudistack-core-verifier` (Java Spring Boot)
- **MFE Login**: `eudistack-mfe-login` (mismo flujo OAuth2 + SSE)
- **Protocolo**: OID4VP 1.0 (OpenID for Verifiable Presentations)
- **Especificación DCQL**: Digital Credentials Query Language
- **OAuth2**: RFC 6749 (Authorization Code Grant)
- **SSE**: Server-Sent Events (W3C Recommendation)

---

## Resumen de Keys Técnicas

| Key | Value |
|-----|-------|
| **Backend URL** | Configurable vía `window["env"]["verifierBackendUrl"]` |
| **OAuth2 Endpoint** | `GET /oidc/authorize` |
| **Client ID** | `proximity-verifier-pwa` (debe estar registrado) |
| **Redirect URI** | `{origin}/login` |
| **Scope** | `openid learcredential.employee` |
| **OID4VP Endpoint** | `GET /oid4vp/auth-request/{nonce}` |
| **Wallet Response** | `POST /oid4vp/auth-response` |
| **SSE Endpoint** | `GET /api/login/events?state={state}` |
| **SSE Event Name** | `redirect` |
| **QR Content** | URL `openid4vp://?client_id=...&request_uri=...` |
| **QR Library** | `angularx-qrcode` |
| **Timeout SSE** | 120 segundos (configurable) |
| **JWT Expiration** | 5 minutos (en Authorization Request) |
| **Cache Strategy** | One-time use (JWT se elimina tras descarga) |
