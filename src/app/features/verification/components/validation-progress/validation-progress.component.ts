import { Component, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from '../../../../shared/components/header/header.component';

/**
 * Validation check status
 */
export type CheckStatus = 'pending' | 'validating' | 'success' | 'error';

/**
 * Validation check item
 */
export interface ValidationCheck {
  key: string;
  label: string;
  status: CheckStatus;
}

/**
 * Validation Progress Component
 * 
 * Fullscreen overlay that displays technical validation checks in real-time.
 * Shows when backend is validating the VP token received from wallet.
 * 
 * Features:
 * - Shield icon (security visual)
 * - Horizontal progress bar (animated fill)
 * - Sequential validation checks with icons:
 *   ○ Pending (gray circle)
 *   🔄 Validating (spinning blue)
 *   ✓ Success (green check)
 *   ✗ Error (red cross)
 * - Stops on first error
 * - OK or Retry buttons based on outcome
 * - i18n support
 * 
 * @component
 * @standalone
 */
@Component({
  selector: 'app-validation-progress',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    TranslateModule,
    HeaderComponent
  ],
  templateUrl: './validation-progress.component.html',
  styleUrls: ['./validation-progress.component.scss']
})
export class ValidationProgressComponent implements OnInit, OnDestroy {
  /**
   * Whether the modal is open
   */
  public readonly isOpen = input<boolean>(false);

  /**
   * Validation results for each check
   * Order: vpSignature, vcSignature, trustedIssuer, notRevoked
   */
  public readonly validationResults = input<boolean[]>([true, true, true, true]);

  /**
   * Event emitted when OK button is clicked
   */
  public readonly okClicked = output<void>();

  /**
   * Event emitted when Retry button is clicked
   */
  public readonly retryClicked = output<void>();

  // ── State ──
  public readonly checks = signal<ValidationCheck[]>([
    { key: 'vpSignature', label: 'verification.validation.progress.vpSignature', status: 'pending' },
    { key: 'vcSignature', label: 'verification.validation.progress.vcSignature', status: 'pending' },
    { key: 'trustedIssuer', label: 'verification.validation.progress.trustedIssuer', status: 'pending' },
    { key: 'notRevoked', label: 'verification.validation.progress.notRevoked', status: 'pending' }
  ]);

  public readonly allSuccess = signal<boolean>(false);
  public readonly hasError = signal<boolean>(false);
  public readonly isValidating = signal<boolean>(false);
  public readonly isRevocationError = signal<boolean>(false);

  // Continuous progress percentage driven by a requestAnimationFrame ramp, so the bar
  // advances fluidly instead of jumping between discrete 25% steps.
  public readonly progressPercentage = signal<number>(0);

  private animationTimeouts: number[] = [];
  private progressRafId: number | null = null;

  public ngOnInit(): void {
    if (this.isOpen()) {
      this.startValidation();
    }
  }

  public ngOnDestroy(): void {
    this.clearTimeouts();
  }

  /**
   * Start sequential validation animation
   */
  public startValidation(): void {
    this.isValidating.set(true);
    this.allSuccess.set(false);
    this.hasError.set(false);
    this.isRevocationError.set(false);
    this.resetChecks();
    this.stopProgressRamp();
    this.progressPercentage.set(0);

    const results = this.validationResults();
    let currentIndex = 0;

    // Animation timings (ms)
    const CHECK_DURATION = 1000;      // time each check stays in 'validating' before resolving
    const VIEW_DELAY = 900;           // dwell time after all checks succeed, for the success burst
    const AUTO_ADVANCE_DELAY = 1200;  // extra time before advancing to welcome screen
    const ERROR_REDIRECT_DELAY = 1600;

    // Kick off a continuous progress ramp over the expected happy-path duration.
    // If a check fails later, stopProgressRamp() freezes the bar at the failure point.
    const totalChecks = this.checks().length;
    const rampEndPercent = (results.every(Boolean)
      ? totalChecks
      : results.findIndex(r => !r) + 1) / totalChecks * 100;
    const rampDurationMs = (rampEndPercent / 100) * totalChecks * CHECK_DURATION;
    this.startProgressRamp(rampEndPercent, rampDurationMs);

    const animateNext = () => {
      if (currentIndex >= this.checks().length) {
        // All checks completed successfully — trigger success state immediately so the
        // shield animation starts alongside the final green check, then auto-advance.
        this.isValidating.set(false);
        this.allSuccess.set(!this.hasError());

        if (!this.hasError()) {
          const autoAdvanceDelay = window.setTimeout(() => {
            console.log('[ValidationProgress] Auto-advancing to success...');
            this.okClicked.emit();
          }, VIEW_DELAY + AUTO_ADVANCE_DELAY);
          this.animationTimeouts.push(autoAdvanceDelay);
        }
        return;
      }

      // Set current check to validating
      this.updateCheckStatus(currentIndex, 'validating');

      const timeoutId = window.setTimeout(() => {
        const success = results[currentIndex];
        this.updateCheckStatus(currentIndex, success ? 'success' : 'error');

        if (!success) {
          this.hasError.set(true);
          this.isValidating.set(false);

          if (currentIndex === 3) {
            console.log('[ValidationProgress] Revocation check failed - auto-redirecting to revoked screen...');
            this.isRevocationError.set(true);
            const autoRedirectDelay = window.setTimeout(() => {
              console.log('[ValidationProgress] Auto-redirecting to credential revoked screen');
              this.retryClicked.emit();
            }, ERROR_REDIRECT_DELAY);
            this.animationTimeouts.push(autoRedirectDelay);
          }

          return;
        }

        currentIndex++;
        animateNext();
      }, CHECK_DURATION);

      this.animationTimeouts.push(timeoutId);
    };

    animateNext();
  }

  /**
   * Handle OK button click
   */
  public onOkClick(): void {
    this.clearTimeouts();
    this.okClicked.emit();
  }

  /**
   * Handle Retry button click
   */
  public onRetryClick(): void {
    this.clearTimeouts();
    this.retryClicked.emit();
  }

  /**
   * Get icon name based on check status
   */
  public getIconName(status: CheckStatus): string {
    switch (status) {
      case 'pending':
        return 'ellipse-outline';
      case 'validating':
        return 'sync-outline';
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      default:
        return 'ellipse-outline';
    }
  }

  /**
   * Get color based on check status
   */
  public getIconColor(status: CheckStatus): string {
    switch (status) {
      case 'pending':
        return 'medium';
      case 'validating':
        return 'primary';
      case 'success':
        return 'success';
      case 'error':
        return 'danger';
      default:
        return 'medium';
    }
  }

  /**
   * Reset all checks to pending state
   */
  private resetChecks(): void {
    this.checks.update(checks => 
      checks.map(check => ({ ...check, status: 'pending' as CheckStatus }))
    );
  }

  /**
   * Update status of a specific check
   */
  private updateCheckStatus(index: number, status: CheckStatus): void {
    this.checks.update(checks => {
      const updated = [...checks];
      updated[index] = { ...updated[index], status };
      return updated;
    });
  }

  /**
   * Clear all animation timeouts
   */
  private clearTimeouts(): void {
    this.animationTimeouts.forEach(id => window.clearTimeout(id));
    this.animationTimeouts = [];
    this.stopProgressRamp();
  }

  /**
   * Drive `progressPercentage` continuously from its current value up to `targetPercent`
   * over `durationMs`, using requestAnimationFrame for smooth 60fps motion.
   */
  private startProgressRamp(targetPercent: number, durationMs: number): void {
    this.stopProgressRamp();
    if (durationMs <= 0 || targetPercent <= this.progressPercentage()) {
      this.progressPercentage.set(targetPercent);
      return;
    }

    const startPercent = this.progressPercentage();
    const delta = targetPercent - startPercent;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      // Ease-out for a natural settle at the end.
      const eased = 1 - Math.pow(1 - t, 3);
      this.progressPercentage.set(startPercent + delta * eased);

      if (t < 1) {
        this.progressRafId = requestAnimationFrame(step);
      } else {
        this.progressRafId = null;
      }
    };

    this.progressRafId = requestAnimationFrame(step);
  }

  /**
   * Freeze the progress ramp at its current value (used on error or teardown).
   */
  private stopProgressRamp(): void {
    if (this.progressRafId !== null) {
      cancelAnimationFrame(this.progressRafId);
      this.progressRafId = null;
    }
  }
}
