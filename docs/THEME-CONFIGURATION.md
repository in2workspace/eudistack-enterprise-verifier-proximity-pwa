# Cómo Cambiar el Theme del Verifier PWA

Este documento explica las 3 formas de cambiar el tema (multi-tenancy) en el Verifier PWA KPMG.

---

## 📋 Opciones Disponibles

### **1️⃣ Via URL Query Parameter (Más Simple)**

La forma más rápida para probar diferentes temas sin modificar código:

```bash
# Theme KPMG (por defecto)
http://localhost:4200

# Theme KPMG (explícito)
http://localhost:4200?tenant=kpmg

# Theme Altia
http://localhost:4200?tenant=altia

# Theme DOME (si existe dome.theme.json)
http://localhost:4200?tenant=dome
```

✅ **Ventaja:** No requiere rebuild  
⚠️ **Desventaja:** Tienes que añadir el parámetro cada vez

---

### **2️⃣ Via Configuración en `env.js` (Recomendado para Desarrollo)**

Edita `src/assets/env.js` y cambia la variable `tenant`:

```javascript
// ── Multi-Tenancy Configuration ──
// Change this value to switch themes: "kpmg" | "altia" | "dome"
window["env"]["tenant"] = "altia";  // ← Cambiar aquí
```

**Prioridad de carga:**
1. **URL parameter** (más alta) - `?tenant=altia`
2. **env.js** - `window.env.tenant`
3. **Default** - `kpmg` (fallback)

✅ **Ventaja:** Configuras una vez y funciona siempre  
⚠️ **Requiere:** Refresh del navegador después de cambiar

---

### **3️⃣ Via Build Environment (Producción)**

Para builds específicos de cada tenant, puedes crear archivos de environment:

**Crear archivo:** `src/environments/environment.altia.ts`
```typescript
export const environment = {
  production: true,
  tenant: 'altia'
};
```

**Actualizar `angular.json**:
```json
"configurations": {
  "altia": {
    "fileReplacements": [{
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.altia.ts"
    }]
  }
}
```

**Ejecutar:**
```bash
ng build --configuration=altia
```

✅ **Ventaja:** Ideal para CI/CD y deployments por tenant  
⚠️ **Requiere:** Configuración adicional en Angular

---

## 🎨 Temas Disponibles

| Theme ID | Logo | Colores Primarios | Archivo |
|----------|------|-------------------|---------|
| `kpmg` | KPMG Logo | #00338D → #002770 | `assets/themes/kpmg.theme.json` |
| `altia` | Altia Logo | #001E8C → #001570 | `assets/themes/altia.theme.json` |

---

## ➕ Añadir un Nuevo Tema

### **Paso 1: Crear archivo de configuración**

`src/assets/themes/mi-empresa.theme.json`:
```json
{
  "tenantId": "mi-empresa",
  "branding": {
    "name": "Mi Empresa Verification",
    "primaryColor": "#FF5733",
    "primaryDark": "#C70039",
    "secondaryColor": "#FFC300",
    "logoUrl": "assets/logos/mi-empresa-logo.svg"
  },
  "gradients": {
    "primary": { "start": "#FF5733", "end": "#C70039", "angle": 180 },
    "success": { "start": "#00A878", "end": "#008C63", "angle": 135 },
    "error": { "start": "#D32F2F", "end": "#B71C1C", "angle": 135 }
  },
  "components": {
    "header": {
      "backgroundColor": "#ffffff",
      "textColor": "#FF5733",
      "height": "64px",
      "logoHeight": "40px"
    }
  }
}
```

### **Paso 2: Añadir logo**

Coloca el logo SVG en: `src/assets/logos/mi-empresa-logo.svg`

### **Paso 3: Usar el tema**

```bash
# Via URL
http://localhost:4200?tenant=mi-empresa

# O en env.js
window["env"]["tenant"] = "mi-empresa";
```

---

## 🔧 Testing Rápido

Para probar rápidamente todos los temas sin rebuild:

```bash
# Terminal 1: Start server
npm start

# Navegador: Abrir tabs con diferentes temas
http://localhost:4200?tenant=kpmg
http://localhost:4200?tenant=altia
```

---

## 📝 Notas Técnicas

- **Carga dinámica:** Los temas se cargan en `APP_INITIALIZER` (main.ts)
- **CSS Variables:** Cada tema inyecta variables CSS en `:root`
- **Fallback:** Si un tema no existe, usa KPMG hardcodeado
- **Favicon:** Se actualiza dinámicamente según el tema
- **No requiere rebuild:** Cambios en `env.js` o URL son instantáneos (solo refresh)

---

## ⚙️ Variables CSS Inyectadas

Cada tema configura estas CSS variables:

```css
:root {
  --theme-primary: #00338D;
  --theme-primary-dark: #002770;
  --theme-secondary: #8ab4f8;
  --theme-gradient-primary: linear-gradient(...);
  --theme-header-bg: #ffffff;
  --theme-header-text: #00338D;
  --theme-header-height: 64px;
  --theme-header-logo-height: 40px;
}
```

Puedes usarlas en cualquier SCSS:
```scss
.my-component {
  background: var(--theme-primary);
  color: var(--theme-header-text);
}
```

---

## 🚀 Recomendación Final

**Para desarrollo local:** Usa `env.js` (Opción 2)  
**Para pruebas rápidas:** Usa URL param (Opción 1)  
**Para producción:** Usa builds por environment (Opción 3)
