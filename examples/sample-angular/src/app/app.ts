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
  protected readonly title = signal('sample-angular');

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

            // Only handle SMS and email challenges
            if (
              challengeName === AuthChallenge.VERIFY_PHONE ||
              challengeName === AuthChallenge.VERIFY_EMAIL
            ) {
              console.log('[App] SMS/Email challenge detected, will show toast');
              return true;
            }
            if (challengeName === AuthChallenge.MFA_REQUIRED) {
              const method = getMFAMethod(challenge);
              const shouldHandle = method === 'sms' || method === 'email';
              if (shouldHandle) {
                console.log('[App] MFA_REQUIRED challenge with SMS/Email detected, will show toast');
              }
              return shouldHandle;
            }
            if (challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
              // For MFA_SETUP_REQUIRED, method is not in challenge yet when getSetupData() is called
              // The OTP component will handle it manually with the method from query params
              // Skip app-level toast trigger to avoid duplicates - OTP component handles it
              console.log('[App] MFA_SETUP_REQUIRED challenge - skipping app-level toast (OTP component handles it)');
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
