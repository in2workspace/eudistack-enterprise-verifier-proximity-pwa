# JAR by Value - PWA Verifier sin Backend

## Contexto

Esta PWA implementa un verifier OID4VP **sin backend HTTP** usando **JAR by Value** (JWT-Secured Authorization Request by Value).

## Diferencias con Core Verifier

| Aspecto | Core Verifier (Backend) | Proximity PWA (Sin Backend) |
|---------|------------------------|----------------------------|
| **Authorization Request** | JAR by Reference (`request_uri`) | **JAR by Value (`request`)** |
| **QR Code** | URL que apunta a endpoint HTTP | JWT completo incluido en QR |
| **Tamaño QR** | Pequeño (~200 chars) | Grande (~1000-2000 chars) |
| **Endpoint GET** | `GET /oid4vp/auth-request/{id}` | ❌ No necesario |
| **Endpoint POST** | `POST /oid4vp/auth-response` | ⚠️ Ver opciones abajo |

## Implementación Actual

### 1. QR Code (Authorization Request)

```typescript
// URL generada (verification-page.component.ts)
openid4vp://?client_id={DID_KEY}&request={JWT_FIRMADO}
```

**Ventajas:**
- ✅ No requiere backend HTTP
- ✅ Cumple estándar OID4VP (RFC 9101)
- ✅ El wallet puede leer el request directamente

**Desventajas:**
- ⚠️ QR más grande (puede requerir QR de alta densidad)
- ⚠️ JWT visible en el QR (no es problema de seguridad, solo contiene la request pública)

### 2. Authorization Response (VP Token)

El wallet necesita enviar el VP token de vuelta al verifier. **Sin backend HTTP, esto es el mayor desafío.**

## Opciones para Recibir VP Token

### Opción A: Same-Device Flow (Recomendado para Proximity)

**Descripción:** El wallet y el verifier corren en el **mismo dispositivo**. El wallet usa navegación de vuelta.

**Implementación:**

1. **En el Authorization Request JWT**, usar `response_uri` apuntando a la PWA:
   ```json
   {
     "response_uri": "https://verifier-pwa.example.com/verify/response",
     "response_mode": "direct_post"
   }
   ```

2. **Configurar ruta en Angular Router:**
   ```typescript
   // app.routes.ts
   {
     path: 'verify/response',
     component: VerifyResponseComponent
   }
   ```

3. **El wallet hace navegación HTTP POST:**
   - Android: Usa `CustomTabsIntent` o `WebView` con POST
   - iOS: Usa `ASWebAuthenticationSession` con POST callback
   - Web wallet: Hace `fetch()` POST + redirect

4. **Capturar respuesta en PWA:**
   ```typescript
   // En VerifyResponseComponent
   ngOnInit() {
     // Leer parámetros de URL (redirect tras POST)
     const params = new URLSearchParams(window.location.search);
     const vpToken = params.get('vp_token');
     const state = params.get('state');
     
     this.validationService.validatePresentation(vpToken, state);
   }
   ```

**Ventajas:**
- ✅ No requiere infraestructura adicional
- ✅ Funciona completamente en el navegador
- ✅ Compatible con wallets nativos y web

**Desventajas:**
- ⚠️ Solo para same-device (no cross-device)
- ⚠️ Requiere que el wallet soporte POST + redirect

---

### Opción B: WebSocket Relay (Requiere Infraestructura Mínima)

**Descripción:** Usar un relay WebSocket público para enviar el VP token.

**Implementación:**

1. **Verifier PWA se conecta a relay:**
   ```typescript
   const ws = new WebSocket('wss://relay.example.com');
   ws.send({ type: 'register', sessionId: session.sessionId });
   ```

2. **Wallet envía VP token al relay:**
   ```http
   POST https://relay.example.com/submit
   {
     "sessionId": "...",
     "vp_token": "..."
   }
   ```

3. **Relay envía al verifier via WebSocket:**
   ```typescript
   ws.onmessage = (event) => {
     const { vp_token, state } = JSON.parse(event.data);
     this.validationService.validatePresentation(vp_token, state);
   };
   ```

**Ventajas:**
- ✅ Soporta cross-device
- ✅ Tiempo real (no polling)

**Desventajas:**
- ❌ Requiere infraestructura relay (ya no es "sin backend")
- ❌ Complejidad adicional
- ❌ Problemas de privacidad (relay ve VP tokens)

---

### Opción C: Polling con localStorage (Same-Device + Service Worker)

**Descripción:** Usar Service Worker para interceptar POST del wallet y guardar en `localStorage`.

**Implementación:**

1. **Service Worker intercepta POST:**
   ```typescript
   // service-worker.js
   self.addEventListener('fetch', (event) => {
     if (event.request.url.includes('/verify/response') && 
         event.request.method === 'POST') {
       event.respondWith(async () => {
         const formData = await event.request.formData();
         const vpToken = formData.get('vp_token');
         const state = formData.get('state');
         
         // Guardar en Cache API (accesible desde PWA)
         const cache = await caches.open('vp-responses');
         await cache.put(
           new Request(`/vp-response/${state}`),
           new Response(JSON.stringify({ vpToken, state }))
         );
         
         // Redirect de vuelta a la PWA
         return Response.redirect('/verification', 303);
       });
     }
   });
   ```

2. **PWA hace polling:**
   ```typescript
   const interval = setInterval(async () => {
     const cache = await caches.open('vp-responses');
     const response = await cache.match(`/vp-response/${state}`);
     if (response) {
       const data = await response.json();
       clearInterval(interval);
       this.processVpToken(data.vpToken, data.state);
     }
   }, 500);
   ```

**Ventajas:**
- ✅ No requiere backend externo
- ✅ Funciona en same-device

**Desventajas:**
- ⚠️ Complejo (Service Worker intercepta POST)
- ⚠️ No funciona cross-device
- ⚠️ Depende soporte Service Worker

---

## Recomendación

Para una **Proximity PWA** (mismo dispositivo), usar **Opción A (Same-Device Flow)**:

1. ✅ Más simple
2. ✅ No requiere infraestructura adicional
3. ✅ Cumple estándar OID4VP
4. ✅ Compatible con la mayoría de wallets

**Próximos pasos:**
1. Crear ruta `/verify/response` en Angular Router
2. Implementar componente que captura VP token de query params
3. Probar con wallet que soporte POST + redirect (ej. EUDIStack Wallet PWA)

---

## Ejemplo Completo de Flujo

```
┌────────────┐                          ┌─────────────┐
│ Verifier   │                          │   Wallet    │
│ PWA        │                          │   (mismo    │
│            │                          │   device)   │
└─────┬──────┘                          └──────┬──────┘
      │                                        │
      │ 1. Genera QR con JAR by Value         │
      │    openid4vp://?                       │
      │    client_id={DID}&                    │
      │    request={JWT}                       │
      │ ───────────────────────────────────────>
      │                                        │
      │                                        │ 2. Wallet abre
      │                                        │    y parsea JWT
      │                                        │
      │                                        │ 3. Usuario aprueba
      │                                        │
      │                                        │ 4. Wallet crea VP token
      │                                        │
      │ 5. POST /verify/response               │
      │    vp_token={VP}&state={STATE}         │
      │ <───────────────────────────────────────
      │                                        │
      │ 6. Verifica VP token                   │
      │                                        │
      │ 7. Redirect → /verification?success=1  │
      │ ───────────────────────────────────────>
      │                                        │
      │ 8. Muestra resultado                   │
      │                                        │
```

---

## Referencias

- [OID4VP 1.0 - Draft 23](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
- [RFC 9101 - JAR](https://www.rfc-editor.org/rfc/rfc9101.html)
- [Web Share Target API](https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target) (alternativa para recibir datos)
