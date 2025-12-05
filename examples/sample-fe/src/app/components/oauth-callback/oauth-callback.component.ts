import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChallengeNavigationService } from '../../services/challenge-navigation.service';

/**
 * OAuth Callback Component
 *
 * Handles OAuth callbacks from social providers (Google, Facebook, Apple)
 * Extracts tokens from URL query parameters and stores them
 */
@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="oauth-callback">
      <div class="spinner"></div>
      <p>Completing sign in...</p>
    </div>
  `,
  styles: [
    `
      .oauth-callback {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        gap: 1rem;
      }

      .spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      p {
        color: #666;
        font-size: 14px;
      }
    `,
  ],
})
export class OAuthCallbackComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private challengeNav: ChallengeNavigationService,
  ) {}

  ngOnInit(): void {
    // Extract parameters from URL
    this.route.queryParams.subscribe((params) => {
      // Check for error first
      const errorJson = params['error'];
      if (errorJson) {
        try {
          const error = JSON.parse(decodeURIComponent(errorJson));
          this.router.navigate(['/login'], {
            queryParams: { error: error.message || error },
          });
          return;
        } catch (e) {
          // Legacy error format (plain string)
          this.router.navigate(['/login'], {
            queryParams: { error: decodeURIComponent(errorJson) },
          });
          return;
        }
      }

      const action = params['action'];
      const provider = params['provider'];
      const code = params['code'];
      const state = params['state'];
      const resultJson = params['result'];

      // Check if this is a linking action
      if (action === 'link' && provider && code && state) {
        // This is a social account linking flow
        this.linkSocialAccount(provider, code, state);
        return;
      }

      // Login flow via code/state: finalize on backend (cookie or header mode)
      if (provider && code && state && action !== 'link') {
        this.authService.handleSocialCallback({ provider, code, state }).subscribe({
          next: () => {
            // No challenge - authentication successful, navigate to dashboard
            this.router.navigate(['/dashboard']);
          },
          error: (err) => {
            // Check if this is a challenge response (same as native flow handling)
            const challengeObj = (err as any)?.challenge;
            if (
              ((err as any)?.isChallenge || challengeObj) &&
              challengeObj &&
              challengeObj.challengeName
            ) {
              // Challenge is already stored by auth service, use centralized navigation
              this.challengeNav.navigateToChallenge(challengeObj);
              return;
            }

            // Regular error - redirect to login with error message
            this.router.navigate(['/login'], {
              queryParams: { error: err?.error?.message || 'Social sign-in failed' },
            });
          },
        });
        return;
      }

      // Handle result from backend (legacy unified format)
      if (resultJson) {
        try {
          const result = JSON.parse(decodeURIComponent(resultJson));

          // Check if challenge is required
          if (result.challengeName) {
            // Use centralized challenge navigation service
            this.challengeNav.navigateToChallenge(result);
            return;
          }

          // No challenge - process tokens
          // Note: In cookie mode, tokens are in httpOnly cookies, not in result
          // So we check for user presence instead of tokens
          if (result.user || (result.accessToken && result.refreshToken)) {
            // Check if we're in cookie mode (web platform)
            const platformService = (this.authService as any).platformService;
            const isWebCookieMode = platformService && !platformService.isNativePlatform();

            if (!isWebCookieMode && result.accessToken && result.refreshToken) {
              // Header mode (native/mobile): store tokens from result
              const expiresInSeconds = Math.max(
                1,
                Math.floor(result.accessTokenExpiresAt - Date.now() / 1000),
              );

              const tokens = {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: expiresInSeconds,
                expiresAt: result.accessTokenExpiresAt * 1000,
              };

              (this.authService as any).storeTokens(tokens);
            }
            // Cookie mode: tokens are in cookies, just store user

            if (result.user) {
              (this.authService as any).storeUser(result.user);
              // Small delay to ensure cookies are set
              setTimeout(() => {
                this.router.navigate(['/dashboard']);
              }, 100);
            } else {
              // Load user profile if not in result (cookie mode)
              this.authService.loadUserProfile().subscribe({
                next: (user) => {
                  (this.authService as any).storeUser(user);
                  this.router.navigate(['/dashboard']);
                },
                error: () => {
                  this.router.navigate(['/dashboard']);
                },
              });
            }
            return;
          }
        } catch (e) {
          console.error('Failed to parse OAuth result:', e);
        }
      }

      // Fallback: No valid result, redirect to login
      this.router.navigate(['/login']);
    });
  }

  private linkSocialAccount(provider: string, code: string, state: string): void {
    this.authService
      .linkSocialAccount({
        provider: provider as 'google' | 'apple' | 'facebook',
        code,
        state,
      })
      .subscribe({
        next: () => {
          // Link successful - redirect to dashboard
          this.router.navigate(['/dashboard'], {
            queryParams: { success: `${provider} account linked successfully` },
          });
        },
        error: (error) => {
          // Link failed - redirect to dashboard with error
          this.router.navigate(['/dashboard'], {
            queryParams: { error: error.error?.message || 'Failed to link account' },
          });
        },
      });
  }
}
