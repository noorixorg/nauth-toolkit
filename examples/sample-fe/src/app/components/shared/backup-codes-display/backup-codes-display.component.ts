import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Backup Codes Display Component
 *
 * Reusable component for displaying and acknowledging backup codes.
 * Used after first MFA device setup.
 *
 * @example
 * ```html
 * <app-backup-codes-display
 *   [backupCodes]="backupCodes"
 *   (acknowledged)="onAcknowledged()"
 * />
 * ```
 */
@Component({
  selector: 'app-backup-codes-display',
  templateUrl: './backup-codes-display.component.html',
  styleUrls: ['./backup-codes-display.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class BackupCodesDisplayComponent {
  @Input() backupCodes: string[] = [];

  @Output() acknowledged = new EventEmitter<void>();

  /**
   * Handle acknowledgment
   */
  onAcknowledged(): void {
    this.acknowledged.emit();
  }
}

