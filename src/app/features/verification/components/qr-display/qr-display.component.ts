import { Component, input, output, effect, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { QRCodeComponent } from 'angularx-qrcode';
import { TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { PwaInstallService } from '../../../../shared/services/pwa-install.service';
import { interval, Subscription } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

/**
 * QR Display Component
 * 
 * Displays a QR code with countdown timer for verification sessions.
 * 
 * Features:
 * - Large QR code (512x512px, responsive)
 * - Circular countdown timer (120s default)
 * - Warning color when < 30s remaining
 * - Auto-regeneration on expiry
 * - Loading spinner during generation
 * - i18n support
 * 
 * @component
 * @standalone
 */
@Component({
  selector: 'app-qr-display',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    QRCodeComponent,
    TranslateModule,
    HeaderComponent
  ],
  templateUrl: './qr-display.component.html',
  styleUrls: ['./qr-display.component.scss']
})
export class QRDisplayComponent implements OnDestroy {
  /**
   * QR code data (authorization request URL)
   */
  public readonly qrData = input.required<string>();

  /**
   * Total countdown duration in seconds
   * Default: 120s
   */
  public readonly duration = input<number>(120);

  /**
   * Whether to auto-regenerate on expiry
   * Default: true
   */
  public readonly autoRegenerate = input<boolean>(true);

  /**
   * Event emitted when QR expires
   */
  public readonly expired = output<void>();

  /**
   * Event emitted when regeneration is requested
   */
  public readonly regenerate = output<void>();

  /**
   * Event emitted when QR is copied to clipboard
   */
  public readonly copied = output<void>();

  // ── PWA Install ──
  private readonly pwaInstall = inject(PwaInstallService);
  public readonly canInstall$ = this.pwaInstall.installDecision$;
  public readonly bannerDismissed = signal<boolean>(false);

  // ── State ──
  public readonly timeRemaining = signal<number>(120);
  public readonly isExpired = signal<boolean>(false);
  public readonly isLoading = signal<boolean>(false);
  public readonly isCopied = signal<boolean>(false);

  public readonly isLocalEnv = (() => {
    const host = window.location.hostname;
    return host === 'localhost'
      || host === '127.0.0.1'
      || host.endsWith('.nip.io')
      || host.endsWith('.localhost');
  })();

  // ── Computed values ──
  public readonly progress = computed(() => {
    const total = this.duration();
    const remaining = this.timeRemaining();
    return (remaining / total) * 100;
  });

  public readonly isWarning = computed(() => this.timeRemaining() < 30);
  
  public readonly formattedTime = computed(() => {
    const seconds = this.timeRemaining();
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  // ── Subscriptions ──
  private countdownSubscription?: Subscription;

  public constructor() {
    // Start countdown when QR data changes
    effect(() => {
      const data = this.qrData();
      if (data) {
        this.startCountdown();
      }
    });
  }

  /**
   * Trigger native PWA install prompt
   */
  public async installApp(): Promise<void> {
    await this.pwaInstall.promptInstall();
  }

  /**
   * Dismiss the install banner for this session
   */
  public dismissBanner(): void {
    this.bannerDismissed.set(true);
  }

  /**
   * Handle regeneration request
   */
  public onRegenerate(): void {
    this.isLoading.set(true);
    this.regenerate.emit();
    
    // Simulate loading state
    setTimeout(() => {
      this.isLoading.set(false);
    }, 500);
  }

  /**
   * Copy QR data to clipboard
   */
  public async onCopyQR(): Promise<void> {
    try {
      const data = this.qrData();
      if (!data) return;

      await navigator.clipboard.writeText(this.extractAuthRequest(data));
      this.isCopied.set(true);
      this.copied.emit();

      // Reset copied state after 2 seconds
      setTimeout(() => {
        this.isCopied.set(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy QR data:', error);
    }
  }

  /**
   * Extract the raw `openid4vp://...` authRequest from the QR payload.
   *
   * The QR may be wrapped as a wallet redirect URL
   * (`https://wallet/.../protocol/callback?authorization_request=<openid4vp%3A%2F%2F...>`).
   * This unwraps it so the clipboard only contains the authRequest itself.
   */
  private extractAuthRequest(qrPayload: string): string {
    if (qrPayload.startsWith('openid4vp://')) {
      return qrPayload;
    }
    try {
      const url = new URL(qrPayload);
      const wrapped = url.searchParams.get('authorization_request');
      return wrapped ?? qrPayload;
    } catch {
      return qrPayload;
    }
  }

  public ngOnDestroy(): void {
    this.countdownSubscription?.unsubscribe();
  }

  /**
   * Start countdown timer
   */
  private startCountdown(): void {
    // Reset state
    this.timeRemaining.set(this.duration());
    this.isExpired.set(false);
    this.isLoading.set(false);

    // Clear existing subscription
    this.countdownSubscription?.unsubscribe();

    // Start countdown (tick every second)
    this.countdownSubscription = interval(1000)
      .pipe(takeWhile(() => this.timeRemaining() > 0))
      .subscribe({
        next: () => {
          const current = this.timeRemaining();
          this.timeRemaining.set(current - 1);
        },
        complete: () => {
          this.onExpire();
        }
      });
  }

  /**
   * Handle QR expiration
   */
  private onExpire(): void {
    this.isExpired.set(true);
    this.expired.emit();

    if (this.autoRegenerate()) {
      this.onRegenerate();
    }
  }
}

