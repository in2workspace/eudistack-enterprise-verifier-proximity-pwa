import { Component, input, output, signal, computed, OnInit, OnDestroy } from '@angular/core';
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

  // ── Computed ──
  public readonly progressPercentage = computed(() => {
    const successCount = this.checks().filter(c => c.status === 'success').length;
    const totalCount = this.checks().length;
    return totalCount > 0 ? (successCount / totalCount) * 100 : 0;
  });

  private animationTimeouts: number[] = [];

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

    const results = this.validationResults();
    let currentIndex = 0;

    const animateNext = () => {
      if (currentIndex >= this.checks().length) {
        // All checks completed successfully
        // Wait 2 seconds to let user see all green checks
        const viewDelay = window.setTimeout(() => {
          this.isValidating.set(false);
          this.allSuccess.set(!this.hasError());
          
          // After 1.5s more, auto-advance to close modal and show success
          if (!this.hasError()) {
            const autoAdvanceDelay = window.setTimeout(() => {
              console.log('[ValidationProgress] Auto-advancing to success...');
              this.okClicked.emit();
            }, 1500);
            this.animationTimeouts.push(autoAdvanceDelay);
          }
        }, 2000);
        this.animationTimeouts.push(viewDelay);
        return;
      }

      // Set current check to validating
      this.updateCheckStatus(currentIndex, 'validating');

      // After 1s, set result
      const timeoutId = window.setTimeout(() => {
        const success = results[currentIndex];
        this.updateCheckStatus(currentIndex, success ? 'success' : 'error');

        if (!success) {
          // Stop on error
          this.hasError.set(true);
          this.isValidating.set(false);
          
          // Check if error is at index 3 (revocation check)
          if (currentIndex === 3) {
            console.log('[ValidationProgress] Revocation check failed - auto-redirecting to revoked screen...');
            this.isRevocationError.set(true);
            // Wait 2 seconds to let user see the failed check, then auto-advance
            const autoRedirectDelay = window.setTimeout(() => {
              console.log('[ValidationProgress] Auto-redirecting to credential revoked screen');
              this.retryClicked.emit();
            }, 2000);
            this.animationTimeouts.push(autoRedirectDelay);
          }
          
          return;
        }

        // Continue to next
        currentIndex++;
        animateNext();
      }, 1000);

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
  }
}
