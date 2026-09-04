import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { firstValueFrom } from 'rxjs';

/**
 * A third-party application, simulated.
 *
 * This page pretends to be a separate product integrating with this deployment over
 * OpenID Connect. It deliberately uses `angular-auth-oidc-client` — a certified
 * client library by a different author — rather than nauth's own SDK, so what it
 * proves is *interoperability*: that a real integrator can point a conformant client
 * at the discovery document and have everything work.
 *
 * Nothing here knows about nauth. It knows an issuer, a client id, and the protocol.
 */
@Component({
  selector: 'app-rp',
  standalone: true,
  imports: [CommonModule, ButtonModule, MessageModule, ProgressSpinnerModule],
  templateUrl: './rp.component.html',
  styleUrl: './rp.component.css',
})
export class RpComponent implements OnInit {
  private readonly oidc = inject(OidcSecurityService);

  /** True once the library has settled whether there is a session. */
  readonly ready = signal(false);

  /** Whether this simulated application currently has the user signed in. */
  readonly authenticated = signal(false);

  /** Claims from the verified id_token. */
  readonly claims = signal<Record<string, unknown> | null>(null);

  /** The access token, shown truncated as evidence rather than for use. */
  readonly accessToken = signal<string | null>(null);

  /** Anything the library reported going wrong. */
  readonly error = signal<string | null>(null);

  /**
   * Settle the session on load.
   *
   * `checkAuth` also handles the redirect back from the provider: on the callback
   * route it validates `state`, exchanges the code using the PKCE verifier it stored,
   * fetches the JWKS and verifies the id_token signature. Any protocol mistake on the
   * server surfaces here rather than being quietly tolerated.
   */
  async ngOnInit(): Promise<void> {
    try {
      const result = await firstValueFrom(this.oidc.checkAuth());
      this.authenticated.set(result.isAuthenticated);
      this.claims.set((result.userData as Record<string, unknown>) ?? null);
      this.accessToken.set(result.accessToken || null);
      if (result.errorMessage) {
        this.error.set(result.errorMessage);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not complete the sign-in.');
    } finally {
      this.ready.set(true);
    }
  }

  /** Start the authorization code flow. */
  signIn(): void {
    this.error.set(null);
    this.oidc.authorize();
  }

  /** End the session at the provider and locally. */
  signOut(): void {
    this.oidc.logoff().subscribe();
  }

  /** Exchange the refresh token for a fresh access token. */
  async refresh(): Promise<void> {
    try {
      const result = await firstValueFrom(this.oidc.forceRefreshSession());
      this.accessToken.set(result?.accessToken ?? null);
      this.claims.set((result?.userData as Record<string, unknown>) ?? this.claims());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Refresh failed.');
    }
  }

  /** The claims, pretty-printed for display. */
  claimsJson(): string {
    return JSON.stringify(this.claims(), null, 2);
  }

  /** A short, non-usable excerpt of the access token. */
  tokenExcerpt(): string {
    const token = this.accessToken();
    return token ? `${token.slice(0, 24)}…` : '';
  }
}
