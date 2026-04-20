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
    if (this.isStandalone) {
      this.state$.next(false);
      return;
    }

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    if (isIos) {
      this.state$.next(false);
      return;
    }

    const earlyPrompt = (window as any).__pwaInstallPrompt as BeforeInstallPromptEvent | null;
    if (earlyPrompt) {
      this.deferredPrompt = earlyPrompt;
      (window as any).__pwaInstallPrompt = null;
      this.state$.next(true);
    }

    fromEvent<BeforeInstallPromptEvent>(window, 'beforeinstallprompt').subscribe(e => {
      e.preventDefault();
      this.deferredPrompt = e;
      (window as any).__pwaInstallPrompt = null;
      this.state$.next(true);
    });

    const swReady$ = typeof navigator.serviceWorker !== 'undefined'
      ? from(navigator.serviceWorker.ready)
      : NEVER;

    swReady$.pipe(
      take(1),
      switchMap(() => timer(SW_GRACE_MS)),
    ).subscribe(() => {
      if (this.state$.getValue() === null) {
        this.state$.next(false);
      }
    });

    fromEvent(window, 'appinstalled').subscribe(() => {
      this.deferredPrompt = null;
      this.state$.next(false);
    });
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
