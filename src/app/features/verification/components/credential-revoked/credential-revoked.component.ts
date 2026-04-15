import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from '../../../../shared/components/header/header.component';

/**
 * Credential Revoked Component
 * 
 * Modal that displays when a revoked credential is detected during verification.
 * Shows credential details and validation status with clear visual indicators.
 * 
 * Features:
 * - Warning icon (exclamation in rounded square)
 * - Credential information card
 * - Validation status indicators (pass/fail)
 * - Try Again button
 * - i18n support
 * 
 * @component
 * @standalone
 */
@Component({
  selector: 'app-credential-revoked',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    TranslateModule,
    HeaderComponent
  ],
  templateUrl: './credential-revoked.component.html',
  styleUrls: ['./credential-revoked.component.scss']
})
export class CredentialRevokedComponent {
  /**
   * Whether the modal is open
   */
  public readonly isOpen = input<boolean>(false);

  /**
   * Event emitted when Try Again button is clicked
   */
  public readonly tryAgainClicked = output<void>();

  /**
   * Handle Try Again button click
   */
  public onTryAgainClick(): void {
    this.tryAgainClicked.emit();
  }
}
