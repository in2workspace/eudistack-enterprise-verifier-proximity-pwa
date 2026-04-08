import { Component, input, output, effect, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { QRCodeComponent } from 'angularx-qrcode';
import { TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
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
  qrData = input.required<string>();

  /**
   * Total countdown duration in seconds
   * Default: 120s
   */
  duration = input<number>(120);

  /**
   * Whether to auto-regenerate on expiry
   * Default: true
   */
  autoRegenerate = input<boolean>(true);

  /**
   * Event emitted when QR expires
   */
  expired = output<void>();

  /**
   * Event emitted when regeneration is requested
   */
  regenerate = output<void>();

  /**
   * Event emitted when QR is copied to clipboard
   */
  copied = output<void>();

  // ── State ──
  readonly timeRemaining = signal<number>(120);
  readonly isExpired = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly isCopied = signal<boolean>(false);

  // ── Computed values ──
  readonly progress = computed(() => {
    const total = this.duration();
    const remaining = this.timeRemaining();
    return (remaining / total) * 100;
  });

  readonly isWarning = computed(() => this.timeRemaining() < 30);
  
  readonly formattedTime = computed(() => {
    const seconds = this.timeRemaining();
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  // ── Subscriptions ──
  private countdownSubscription?: Subscription;

  constructor() {
    // Start countdown when QR data changes
    effect(() => {
      const data = this.qrData();
      if (data) {
        this.startCountdown();
      }
    });
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

  /**
   * Handle regeneration request
   */
  onRegenerate(): void {
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
  async onCopyQR(): Promise<void> {
    try {
      const data = this.qrData();
      if (!data) return;

      await navigator.clipboard.writeText(data);
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

  ngOnDestroy(): void {
    this.countdownSubscription?.unsubscribe();
  }
}

