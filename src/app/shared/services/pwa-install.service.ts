import { Injectable } from '@angular/core';
import { BehaviorSubject, NEVER, from, fromEvent, timer } from 'rxjs';
import { distinctUntilChanged, filter, switchMap, take } from 'rxjs/operators';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const SW_GRACE_MS = 2000;

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly state$ = new BehaviorSubject<boolean | null>(null);

  readonly installDecision$ = this.state$.pipe(
    filter((v): v is boolean => v !== null),
    distinctUntilChanged()
  );

  constructor() {
    // [PWA-DEBUG] Remove before release
    console.log('[PwaInstallService] v2 loaded — SW_GRACE_MS:', SW_GRACE_MS);
    console.log('[PwaInstallService] userAgent:', navigator.userAgent);
    console.log('[PwaInstallService] serviceWorker available:', typeof navigator.serviceWorker !== 'undefined');

    if (this.isStandalone) {
      console.log('[PwaInstallService] standalone mode detected → false');
      this.state$.next(false);
      return;
    }
    console.log('[PwaInstallService] not standalone');

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    console.log('[PwaInstallService] isIos:', isIos);
    if (isIos) {
      console.log('[PwaInstallService] iOS/iPadOS detected → false');
      this.state$.next(false);
      return;
    }

    const earlyPrompt = (window as any).__pwaInstallPrompt as BeforeInstallPromptEvent | null;
    console.log('[PwaInstallService] earlyPrompt:', earlyPrompt ? 'found' : 'not found');
    if (earlyPrompt) {
      this.deferredPrompt = earlyPrompt;
      (window as any).__pwaInstallPrompt = null;
      console.log('[PwaInstallService] earlyPrompt captured → true');
      this.state$.next(true);
    }

    fromEvent<BeforeInstallPromptEvent>(window, 'beforeinstallprompt').subscribe(e => {
      console.log('[PwaInstallService] beforeinstallprompt received → true');
      e.preventDefault();
      this.deferredPrompt = e;
      (window as any).__pwaInstallPrompt = null;
      this.state$.next(true);
    });

    const swReady$ = typeof navigator.serviceWorker !== 'undefined'
      ? from(navigator.serviceWorker.ready)
      : NEVER;

    if (typeof navigator.serviceWorker === 'undefined') {
      console.log('[PwaInstallService] serviceWorker not available → fallback will never fire');
    } else {
      console.log('[PwaInstallService] waiting for SW ready...');
      navigator.serviceWorker.ready.then(reg => {
        console.log('[PwaInstallService] SW ready — scope:', reg.scope, '— waiting', SW_GRACE_MS, 'ms');
      });
    }

    swReady$.pipe(
      take(1),
      switchMap(() => timer(SW_GRACE_MS)),
    ).subscribe(() => {
      const current = this.state$.getValue();
      console.log('[PwaInstallService] SW grace period expired — state was:', current);
      if (current === null) {
        console.log('[PwaInstallService] no prompt received → fallback false');
        this.state$.next(false);
      } else {
        console.log('[PwaInstallService] prompt already locked at:', current, '— fallback ignored');
      }
    });

    fromEvent(window, 'appinstalled').subscribe(() => {
      console.log('[PwaInstallService] appinstalled fired → false');
      this.deferredPrompt = null;
      this.state$.next(false);
    });

    this.installDecision$.subscribe(v =>
      console.log('[PwaInstallService] installDecision$ emitted:', v)
    );
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.state$.next(false);
    return outcome === 'accepted';
  }

  get isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  }
}
