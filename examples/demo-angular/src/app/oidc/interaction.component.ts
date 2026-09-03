import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '@nauth-toolkit/client-angular/standalone';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/** Key under which a pending interaction is remembered across the login detour. */
export const PENDING_INTERACTION_KEY = 'nauth.pendingInteraction';

/** What the backend bridge reports about a pending authorization request. */
interface InteractionState {
  uid: string;
  prompt: string;
  client: { clientId: string; clientName?: string; logoUri?: string; clientUri?: string };
  scopes: string[];
  missingScopes: string[];
  gate: 'authenticated' | 'login_required' | 'denied';
  gateReason?: string;
  sub?: string;
}

/** Human wording for the scopes this demo issues. */
const SCOPE_LABELS: Record<string, string> = {
  openid: 'Confirm who you are',
  email: 'See your email address',
  profile: 'See your name and profile details',
  phone: 'See your phone number',
  offline_access: 'Stay signed in when you are away',
};

/**
 * The OpenID Connect interaction page.
 *
 * When a third-party application asks this deployment to authenticate someone, the
 * provider parks the request and sends the browser here. This page asks the backend
 * what the request needs, and then either sends the user through the ordinary nauth
 * login or shows them what the application is asking for.
 *
 * Nothing about nauth's login is special-cased. If the user is not signed in, the
 * pending interaction is remembered and they are sent to `/login`, where the existing
 * challenge flow runs unchanged — forced password change, email and phone
 * verification, MFA. A navigation handler configured in `app.config.ts` brings them
 * back here afterwards.
 *
 * The page must tolerate being re-entered under a *different* id: the login step and
 * the consent step are two separate interactions with two separate ids.
 */
@Component({
  selector: 'app-oidc-interaction',
  standalone: true,
  imports: [CommonModule, ButtonModule, MessageModule, ProgressSpinnerModule],
  templateUrl: './interaction.component.html',
  styleUrl: './interaction.component.css',
})
export class OidcInteractionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** What the page is currently showing. */
  readonly view = signal<'loading' | 'consent' | 'error'>('loading');

  /** The pending request, once loaded. */
  readonly state = signal<InteractionState | null>(null);

  /** An error to show instead of the consent screen. */
  readonly error = signal<string | null>(null);

  /** True while an approve or deny request is in flight. */
  readonly submitting = signal(false);

  /**
   * Load the pending interaction and decide what to do with it.
   */
  async ngOnInit(): Promise<void> {
    const uid = this.route.snapshot.paramMap.get('uid');
    if (!uid) {
      this.fail('This authorization link is missing its request id.');
      return;
    }

    try {
      const state = await this.load(uid);
      this.state.set(state);

      if (state.gate === 'denied') {
        // The account cannot authorize anything — tell the client, don't strand the user.
        await this.resolveAndLeave(uid, 'abort');
        return;
      }

      if (state.gate === 'login_required') {
        // Remember where to come back to, then hand over to the ordinary login flow.
        sessionStorage.setItem(PENDING_INTERACTION_KEY, uid);
        void this.router.navigate(['/login'], { queryParams: { interaction: uid } });
        return;
      }

      sessionStorage.removeItem(PENDING_INTERACTION_KEY);

      if (state.prompt === 'login') {
        // Already signed in: complete the login step without showing anything.
        await this.resolveAndLeave(uid, 'login');
        return;
      }

      this.view.set('consent');
    } catch {
      this.fail('This authorization request has expired. Please start again from the application.');
    }
  }

  /** The scopes to show, with wording the user can act on. */
  scopeLines(): { scope: string; label: string }[] {
    const state = this.state();
    if (!state) {
      return [];
    }
    const shown = state.missingScopes.length > 0 ? state.missingScopes : state.scopes;
    return shown
      .filter((scope) => scope !== 'openid' || shown.length === 1)
      .map((scope) => ({ scope, label: SCOPE_LABELS[scope] ?? scope }));
  }

  /** The application's display name. */
  clientName(): string {
    const state = this.state();
    return state?.client.clientName ?? state?.client.clientId ?? 'An application';
  }

  /**
   * Grant the application what it asked for.
   */
  async approve(): Promise<void> {
    await this.decide(true);
  }

  /**
   * Refuse the request. The application is told `access_denied`.
   */
  async deny(): Promise<void> {
    await this.decide(false);
  }

  /**
   * Send the decision and follow the provider's redirect.
   */
  private async decide(approve: boolean): Promise<void> {
    const uid = this.state()?.uid;
    if (!uid || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    try {
      const { redirectTo } = await firstValueFrom(
        this.http.post<{ redirectTo: string }>(
          `${environment.apiBaseUrl}/oidc/interaction/${uid}/confirm`,
          { approve },
          { withCredentials: true },
        ),
      );
      // Leaving Angular entirely — the provider resumes and redirects to the client.
      window.location.assign(redirectTo);
    } catch {
      this.submitting.set(false);
      this.fail('That decision could not be recorded. Please start again from the application.');
    }
  }

  /**
   * Read the pending interaction from the backend bridge.
   */
  private load(uid: string): Promise<InteractionState> {
    return firstValueFrom(
      this.http.get<InteractionState>(`${environment.apiBaseUrl}/oidc/interaction/${uid}`, {
        withCredentials: true,
      }),
    );
  }

  /**
   * Resolve the interaction on the backend and follow wherever it points.
   */
  private async resolveAndLeave(uid: string, action: 'login' | 'abort'): Promise<void> {
    const { redirectTo } = await firstValueFrom(
      this.http.post<{ redirectTo: string }>(
        `${environment.apiBaseUrl}/oidc/interaction/${uid}/${action}`,
        {},
        { withCredentials: true },
      ),
    );
    window.location.assign(redirectTo);
  }

  /** Show an error instead of the consent screen. */
  private fail(message: string): void {
    sessionStorage.removeItem(PENDING_INTERACTION_KEY);
    this.error.set(message);
    this.view.set('error');
  }

  /** Whether a user is signed in, for the "not you?" affordance. */
  isSignedIn(): boolean {
    return Boolean(this.auth.getCurrentUser());
  }
}
