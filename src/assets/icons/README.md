# PWA Icons for KPMG Verifier

## Required Icons

The manifest.webmanifest references the following icons that need to be created:

### 1. `pwa-192x192.png`
- **Size**: 192x192 pixels
- **Purpose**: Standard PWA icon (Android, Chrome)
- **Design**: KPMG logo on #00338D blue background with white border

### 2. `pwa-512x512.png`
- **Size**: 512x512 pixels
- **Purpose**: High-resolution PWA icon (splash screens)
- **Design**: KPMG logo on #00338D blue background with white border

### 3. `pwa-maskable-512x512.png`
- **Size**: 512x512 pixels
- **Purpose**: Adaptive icon for Android (maskable)
- **Design**: KPMG logo centered in safe zone (80% of canvas)
- **Safe zone**: Logo must fit within center 80% circle
- **Bleed area**: Background extends to full 512x512

## Design Guidelines

- **Primary color**: #00338D (KPMG Blue)
- **Contrast color**: #ffffff (White)
- **Logo**: Use official KPMG logo
- **Padding**: 10% minimum padding for standard icons
- **Format**: PNG with transparency where applicable

## Temporary Placeholder

Until official icons are created, you can use:
- Solid #00338D background
- White "KPMG" text centered
- Or copy from eudistack-core-wallet-pwa as temporary placeholders

## Tools

- **Figma/Sketch**: Design icons with KPMG brand guidelines
- **PWA Asset Generator**: https://github.com/onderceylan/pwa-asset-generator
- **Maskable.app**: https://maskable.app/ (test maskable icons)

## Installation

Once icons are ready, place them in this directory:
```
src/assets/icons/
  ├── pwa-192x192.png
  ├── pwa-512x512.png
  └── pwa-maskable-512x512.png
```
