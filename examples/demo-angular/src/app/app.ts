import { Component, signal, effect, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, AuthResponse } from '@nauth-toolkit/client-angular/standalone';
import { AuthChallenge, getMFAMethod } from '@nauth-toolkit/client';
import { Subscription, filter } from 'rxjs';
import { SimulatedVerificationCodeService } from './services/simulated-verification-code.service';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { VerificationCodeToastComponent } from './components/verification-code-toast.component';

/**
 * Root application component
 *
 * Displays a dismissable demo banner and router outlet.
 * Handles verification code toasts for SMS/email challenges in simulation mode.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, ToastModule, TooltipModule, VerificationCodeToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('demo-angular');

  /**
   * Banner visibility state
   * Persisted in sessionStorage
   */
  protected readonly showBanner = signal<boolean>(true);

  private readonly auth = inject(AuthService);
  private readonly verificationCodeService = inject(SimulatedVerificationCodeService);
  private subscriptions = new Subscription();

  constructor() {
    // Load banner state from sessionStorage on init
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const dismissed = sessionStorage.getItem('demo-banner-dismissed');
      this.showBanner.set(dismissed !== 'true');
    }

    // Persist banner dismissal to sessionStorage
    effect(() => {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (!this.showBanner()) {
          sessionStorage.setItem('demo-banner-dismissed', 'true');
        }
      }
    });
  }

  /**
   * Initialize authentication event listeners
   */
  ngOnInit(): void {
    // Subscribe to challenge events for verification code display
    this.subscriptions.add(
      this.auth.authEvents$
        .pipe(
          filter((event) => {
            // Debug: log all events to see what's coming through
            if (event.type === 'auth:challenge' || event.type === 'auth:success' || event.type === 'auth:login' || event.type === 'auth:signup') {
              console.log('[App] Auth event received:', event.type, event.data);
            }
            return event.type === 'auth:challenge';
          }),
          filter((event) => {
            const challenge = event.data as AuthResponse;
            const challengeName = challenge.challengeName;
            console.log('[App] Challenge event filtered:', challengeName, challenge);

            if (!challengeName) return false;

            // Skip all OTP-based challenges - the OTP component handles toasts for these
            // to avoid duplicates. The OTP component has better context (session IDs, method detection, etc.)
            if (
              challengeName === AuthChallenge.VERIFY_PHONE ||
              challengeName === AuthChallenge.VERIFY_EMAIL ||
              challengeName === AuthChallenge.MFA_REQUIRED ||
              challengeName === AuthChallenge.MFA_SETUP_REQUIRED
            ) {
              console.log('[App] OTP-based challenge detected - skipping app-level toast (OTP component handles it)');
              return false;
            }
            console.log('[App] Challenge type not handled:', challengeName);
            return false;
          }),
        )
        .subscribe(async (event) => {
          const challenge = event.data as AuthResponse;
          console.log('[App] Calling handleChallenge for:', challenge.challengeName, challenge.session);
          await this.verificationCodeService.handleChallenge(challenge);
        }),
    );
  }

  /**
   * Cleanup subscriptions on destroy
   */
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Dismiss the demo banner
   */
  dismissBanner(): void {
    this.showBanner.set(false);
  }
}
