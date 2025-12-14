import { Component, Input, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

/**
 * Custom toast template component for verification codes
 *
 * Displays verification code with copy button in simulation mode.
 * Used by PrimeNG MessageService for custom toast templates.
 */
@Component({
  selector: 'app-verification-code-toast',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  template: `
    <div class="toast-content">
      <div class="font-bold text-base">{{ message.summary }}</div>
      <div class="text-sm mb-2">{{ message.detail }}</div>
      <div class="code-row">
        <span class="code-display">{{ message.data?.code }}</span>
        <p-button
          [icon]="copied ? 'pi pi-check' : 'pi pi-copy'"
          [text]="true"
          [severity]="copied ? 'success' : 'secondary'"
          size="small"
          [rounded]="true"
          (onClick)="copyCode()"
          [pTooltip]="copied ? 'Copied!' : 'Copy code'"
          tooltipPosition="top"
          [ariaLabel]="copied ? 'Copied!' : 'Copy code'"
        />
        <button type="button" (click)="dismiss()" class="dismiss-link" aria-label="Dismiss">
          Dismiss
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .toast-content {
        padding: 1rem;
      }

      .code-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
      }

      .code-display {
        font-size: 1.5rem;
        font-weight: 700;
        font-family: monospace;
        white-space: nowrap;
      }

      .dismiss-link {
        background: none;
        border: none;
        color: inherit;
        text-decoration: underline;
        cursor: pointer;
        font-size: 0.875rem;
        padding: 0.25rem 0.5rem;
        opacity: 0.7;
        transition: opacity 0.2s;
        white-space: nowrap;
        margin-left: auto;
      }

      .dismiss-link:hover {
        opacity: 1;
      }

      .dismiss-link:focus {
        outline: 2px solid currentColor;
        outline-offset: 2px;
        border-radius: 4px;
      }
    `,
  ],
})
export class VerificationCodeToastComponent {
  @Input() message!: {
    severity?: string;
    summary?: string;
    detail?: string;
    data?: { code: string; type: 'sms' | 'email' };
    [key: string]: unknown;
  };

  private readonly messageService = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  copied = false;

  /**
   * Copy verification code to clipboard
   */
  async copyCode(): Promise<void> {
    const code = this.message.data?.code;
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      // Defer the state change to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.copied = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.copied = false;
          this.cdr.markForCheck();
        }, 2000);
      }, 0);
    } catch {
      // Silently handle clipboard errors - non-critical operation
      // Clipboard may not be available in all environments
    }
  }

  /**
   * Dismiss all toasts for this type (sms or email)
   */
  dismiss(): void {
    const type = this.message.data?.type;
    if (type === 'sms' || type === 'email') {
      this.messageService.clear(type);
    } else {
      // Fallback: clear all if type not found
      this.messageService.clear();
    }
  }
}
