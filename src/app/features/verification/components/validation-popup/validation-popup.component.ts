import { Component, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

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
 * Validation Popup Component
 * 
 * Modal overlay that displays sequential validation checks with animations.
 * 
 * Features:
 * - Sequential animated checks (1s each)
 * - ✓ for success, ✗ for error
 * - Stops on first error
 * - OK or Retry buttons based on outcome
 * - i18n support
 * 
 * @component
 * @standalone
 */
@Component({
  selector: 'app-validation-popup',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    TranslateModule
  ],
  templateUrl: './validation-popup.component.html',
  styleUrls: ['./validation-popup.component.scss']
})
export class ValidationPopupComponent implements OnInit, OnDestroy {
  /**
   * Whether the modal is open
   */
  isOpen = input<boolean>(false);

  /**
   * Validation results for each check
   * Order: vpSignature, vcSignature, trustedIssuer, notRevoked
   */
  validationResults = input<boolean[]>([true, true, true, true]);

  /**
   * Event emitted when OK button is clicked
   */
  okClicked = output<void>();

  /**
   * Event emitted when Retry button is clicked
   */
  retryClicked = output<void>();

  // ── State ──
  readonly checks = signal<ValidationCheck[]>([
    { key: 'vpSignature', label: 'verification.validation.checks.vpSignature', status: 'pending' },
    { key: 'vcSignature', label: 'verification.validation.checks.vcSignature', status: 'pending' },
    { key: 'trustedIssuer', label: 'verification.validation.checks.trustedIssuer', status: 'pending' },
    { key: 'notRevoked', label: 'verification.validation.checks.notRevoked', status: 'pending' }
  ]);

  readonly allSuccess = signal<boolean>(false);
  readonly hasError = signal<boolean>(false);
  readonly isValidating = signal<boolean>(false);

  private animationTimeouts: number[] = [];

  ngOnInit(): void {
    if (this.isOpen()) {
      this.startValidation();
    }
  }

  ngOnDestroy(): void {
    this.clearTimeouts();
  }

  /**
   * Start sequential validation animation
   */
  startValidation(): void {
    this.isValidating.set(true);
    this.allSuccess.set(false);
    this.hasError.set(false);
    this.resetChecks();

    const results = this.validationResults();
    let currentIndex = 0;

    const animateNext = () => {
      if (currentIndex >= this.checks().length) {
        this.isValidating.set(false);
        this.allSuccess.set(!this.hasError());
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

  /**
   * Handle OK button click
   */
  onOkClick(): void {
    this.clearTimeouts();
    this.okClicked.emit();
  }

  /**
   * Handle Retry button click
   */
  onRetryClick(): void {
    this.clearTimeouts();
    this.retryClicked.emit();
  }

  /**
   * Get icon name based on check status
   */
  getIconName(status: CheckStatus): string {
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
  getIconColor(status: CheckStatus): string {
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
}
