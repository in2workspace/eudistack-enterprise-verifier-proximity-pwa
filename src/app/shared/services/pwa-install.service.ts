import { Injectable } from '@angular/core';
import { NEVER, Observable, Subject, from, fromEvent, merge, of, race, timer } from 'rxjs';
import { map, shareReplay, switchMap, take } from 'rxjs/operators';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly reset$ = new Subject<false>();

  readonly installDecision$: Observable<boolean>;

  constructor() {
    if (this.isStandalone) {
      this.installDecision$ = of(false);
      return;
    }

    if (/iphone|ipad|ipod|macintosh/i.test(navigator.userAgent)) {
      this.installDecision$ = of(false);
      return;
    }
    const earlyPrompt = (window as any).__pwaInstallPrompt as BeforeInstallPromptEvent | null;

    let promptDecision$: Observable<boolean>;
    if (earlyPrompt) {
      this.deferredPrompt = earlyPrompt;
      (window as any).__pwaInstallPrompt = null;
      promptDecision$ = of(true as const);
    } else {
      promptDecision$ = fromEvent<BeforeInstallPromptEvent>(window, 'beforeinstallprompt').pipe(
        take(1),
        map(e => {
          e.preventDefault();
          this.deferredPrompt = e;
          return true as const;
        })
      );
    }

    // 500 ms grace window after the Service Worker takes control
    const swReady$ = typeof navigator.serviceWorker !== 'undefined'
      ? from(navigator.serviceWorker.ready)
      : NEVER;

    const swFallback$ = swReady$.pipe(
      switchMap(() => timer(500)),
      map(() => false as const),
      take(1)
    );

    this.installDecision$ = merge(
      race(promptDecision$, swFallback$),
      fromEvent(window, 'appinstalled').pipe(
        map(() => {
          this.deferredPrompt = null;
          return false as const;
        })
      ),
      this.reset$
    ).pipe(shareReplay(1));
    this.installDecision$.subscribe();
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.reset$.next(false);
    return outcome === 'accepted';
  }

  get isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  }
}
