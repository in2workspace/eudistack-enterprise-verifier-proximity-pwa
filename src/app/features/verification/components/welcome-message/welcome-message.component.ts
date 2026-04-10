import { Component, input, output, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { interval, Subscription } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

/**
 * Welcome Message Component
 * 
 * Success screen displayed after successful credential verification.
 * 
 * Features:
 * - Personalized welcome message with user name
 * - Green background with large checkmark
 * - 10-second countdown with auto-redirect
 * - Manual "Continue" button
 * - Responsive design
 * - i18n support
 * 
 * @component
 * @standalone
 */
@Component({
  selector: 'app-welcome-message',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    TranslateModule,
    HeaderComponent
  ],
  templateUrl: './welcome-message.component.html',
  styleUrls: ['./welcome-message.component.scss']
})
export class WelcomeMessageComponent implements OnInit, OnDestroy {
  /**
   * User's first name from verified credential
   */
  public readonly firstName = input<string>('');

  /**
   * User's family name from verified credential
   */
  public readonly familyName = input<string>('');

  /**
   * Countdown duration in seconds
   * Default: 10 seconds
   */
  public readonly countdownDuration = input<number>(10);

  /**
   * Whether to auto-redirect after countdown
   * Default: true
   */
  public readonly autoRedirect = input<boolean>(true);

  /**
   * Redirect URL after countdown completes
   * Default: '/'
   */
  public readonly redirectUrl = input<string>('/');

  /**
   * Event emitted when countdown completes
   */
  public readonly countdownComplete = output<void>();

  /**
   * Event emitted when Continue button is clicked
   */
  public readonly continueClicked = output<void>();

  // ── State ──
  public readonly secondsRemaining = signal<number>(10);
  public readonly isCountingDown = signal<boolean>(false);

  // ── Computed values ──
  public readonly fullName = computed(() => {
    const first = this.firstName();
    const family = this.familyName();
    return `${first} ${family}`.trim() || 'User';
  });

  private countdownSubscription?: Subscription;

  public ngOnInit(): void {
    this.secondsRemaining.set(this.countdownDuration());
    
    if (this.autoRedirect()) {
      this.startCountdown();
    }
  }

  public ngOnDestroy(): void {
    this.stopCountdown();
  }

  /**
   * Handle Continue button click
   */
  public onContinueClick(): void {
    this.stopCountdown();
    this.continueClicked.emit();
    
    if (this.autoRedirect()) {
      this.redirect();
    }
  }

  /**
   * Start countdown timer
   */
  private startCountdown(): void {
    this.isCountingDown.set(true);

    this.countdownSubscription = interval(1000)
      .pipe(
        takeWhile(() => this.secondsRemaining() > 0, true)
      )
      .subscribe({
        next: () => {
          const remaining = this.secondsRemaining();
          if (remaining > 0) {
            this.secondsRemaining.set(remaining - 1);
          }
          
          // Check if countdown is complete
          if (this.secondsRemaining() === 0) {
            this.isCountingDown.set(false);
          }
        },
        complete: () => {
          this.onCountdownComplete();
        }
      });
  }

  /**
   * Stop countdown timer
   */
  private stopCountdown(): void {
    this.countdownSubscription?.unsubscribe();
    this.countdownSubscription = undefined;
    this.isCountingDown.set(false);
  }

  /**
   * Handle countdown completion
   */
  private onCountdownComplete(): void {
    this.countdownComplete.emit();
    
    if (this.autoRedirect()) {
      this.redirect();
    }
  }

  /**
   * Redirect to configured URL
   */
  private redirect(): void {
    window.location.href = this.redirectUrl();
  }
}
