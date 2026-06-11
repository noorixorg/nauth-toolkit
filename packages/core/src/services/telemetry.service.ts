import { randomUUID } from 'crypto';
import { NAuthConfig } from '../interfaces/config.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { getCoreVersion } from '../utils/get-package-version';
import { MFAService } from './mfa.service';
import { SocialProviderRegistry } from './social-provider-registry.service';

/**
 * Default telemetry ingestion endpoint (stable custom domain; the deployment
 * behind it can change without a package release).
 */
const DEFAULT_ENDPOINT = 'https://telemetry.nauth.dev/';

/** Storage key holding the shared anonymous instance identifier. */
const INSTANCE_ID_KEY = 'nauth:telemetry:instance_id';

/** Network timeout for telemetry requests — beyond this the request is aborted. */
const SEND_TIMEOUT_MS = 3000;

/** Heartbeat base interval (24h); a random jitter of up to 1h is added per process. */
const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const HEARTBEAT_JITTER_MS = 60 * 60 * 1000;

/**
 * Anonymous telemetry payload — configuration shape only.
 *
 * Contains no personal data: no IP addresses, secrets, domains, emails,
 * table names, or free-text configuration values. Documented publicly at
 * https://nauth.dev/docs/concepts/telemetry
 */
export interface TelemetryPayload {
  schemaVersion: 1;
  instanceId: string;
  event: 'boot' | 'heartbeat';
  coreVersion: string;
  nodeMajor: number;
  platform: string;
  arch: string;
  nodeEnv: 'production' | 'development' | 'other';
  framework: string;
  config: {
    tokenDeliveryMethod: 'json' | 'cookies' | 'hybrid';
    mfa: {
      enabled: boolean;
      enforcement: 'OPTIONAL' | 'REQUIRED' | 'ADAPTIVE' | null;
      gracePeriodSet: boolean;
      allowedMethods: string[];
    };
    mfaProviders: string[];
    socialProviders: string[];
    storageAdapter: string;
    signupVerificationMethod: string | null;
    auditLogsEnabled: boolean;
    recaptchaEnabled: boolean;
    geoLocationConfigured: boolean;
  };
}

/**
 * Anonymous usage telemetry (opt-out)
 *
 * Sends a small, anonymous payload describing the *shape* of the nauth
 * configuration (enums, booleans, and registered provider names — never
 * values) once at boot and once per day thereafter. The data guides
 * development priorities; see https://nauth.dev/docs/concepts/telemetry
 * for the exact payload and rationale.
 *
 * **Performance guarantees:**
 * - Never runs inside a request path — no middleware or handler involvement
 * - The boot ping is deferred and fire-and-forget; `NAuth.create()` gains no awaits
 * - The heartbeat timer is unref'd and never keeps the process alive
 * - Network failures are swallowed at debug level; this service never throws
 *
 * **Disabled automatically** when any of the following holds:
 * - `config.telemetry.enabled === false`
 * - `NAUTH_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1`
 * - `CI=true` or `NODE_ENV=test`
 *
 * @example
 * ```typescript
 * const telemetry = new TelemetryService(config, storage, logger, 'express', mfaService, socialRegistry);
 * telemetry.sendBootPing();
 * telemetry.startHeartbeat();
 * // ...on shutdown:
 * telemetry.shutdown();
 * ```
 */
export class TelemetryService {
  private heartbeatTimer?: NodeJS.Timeout;
  private cachedInstanceId?: string;
  private disclosureShown = false;

  constructor(
    private readonly config: NAuthConfig,
    private readonly storageAdapter: StorageAdapter,
    private readonly logger?: NAuthLogger,
    private readonly framework: string = 'unknown',
    private readonly mfaService?: MFAService,
    private readonly socialProviderRegistry?: SocialProviderRegistry,
  ) {}

  /**
   * Whether telemetry is active for this process.
   *
   * Evaluates the config flag and all environment opt-outs
   * (NAUTH_TELEMETRY_DISABLED, DO_NOT_TRACK, CI, NODE_ENV=test).
   *
   * @returns true when telemetry may be sent
   */
  isEnabled(): boolean {
    if (this.config.telemetry?.enabled === false) {
      return false;
    }
    const env = process.env;
    const truthy = (v: string | undefined): boolean => v === '1' || v?.toLowerCase() === 'true';
    if (truthy(env.NAUTH_TELEMETRY_DISABLED) || truthy(env.DO_NOT_TRACK)) {
      return false;
    }
    if (env.CI !== undefined && env.CI !== '' && env.CI.toLowerCase() !== 'false') {
      return false;
    }
    if (env.NODE_ENV === 'test') {
      return false;
    }
    return true;
  }

  /**
   * Send the boot ping (fire-and-forget).
   *
   * On the first boot of an install (when the anonymous instance ID is
   * created), a one-time disclosure notice is logged. Subsequent boots of
   * the same install are silent. This method returns immediately and never
   * throws; all work happens off the startup path.
   */
  sendBootPing(): void {
    if (!this.isEnabled()) {
      return;
    }
    this.resolveInstanceId()
      .then(({ instanceId, isNew }) => {
        if (isNew && !this.disclosureShown) {
          this.disclosureShown = true;
          this.logger?.log?.(
            'nauth-toolkit collects anonymous usage data (config shape only — no PII, IPs, or secrets) to guide development. ' +
              'Details and opt-out: https://nauth.dev/docs/concepts/telemetry (set NAUTH_TELEMETRY_DISABLED=1 to disable)',
          );
        }
        return this.send(this.buildPayload('boot', instanceId));
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger?.debug?.(`Telemetry boot ping skipped: ${message}`);
      });
  }

  /**
   * Start the daily heartbeat timer.
   *
   * The timer is unref'd so it never prevents process exit. A random jitter
   * of up to one hour avoids synchronized pings from fleets that restart
   * together. No-op when telemetry is disabled.
   */
  startHeartbeat(): void {
    if (!this.isEnabled() || this.heartbeatTimer) {
      return;
    }
    const interval = HEARTBEAT_INTERVAL_MS + Math.floor(Math.random() * HEARTBEAT_JITTER_MS);
    this.heartbeatTimer = setInterval(() => {
      this.resolveInstanceId()
        .then(({ instanceId }) => this.send(this.buildPayload('heartbeat', instanceId)))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.logger?.debug?.(`Telemetry heartbeat skipped: ${message}`);
        });
    }, interval);
    this.heartbeatTimer.unref?.();
  }

  /**
   * Stop the heartbeat timer. Safe to call multiple times.
   */
  shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Resolve the anonymous instance ID shared by all processes of a deployment.
   *
   * Uses an NX (set-if-absent) write to the storage adapter so concurrent
   * processes converge on one ID; falls back to a per-process UUID when
   * storage is unavailable. `isNew` is true only for the process that
   * created the ID — used to show the disclosure notice exactly once per install.
   */
  private async resolveInstanceId(): Promise<{ instanceId: string; isNew: boolean }> {
    if (this.cachedInstanceId) {
      return { instanceId: this.cachedInstanceId, isNew: false };
    }
    try {
      const candidate = randomUUID();
      const existing = await this.storageAdapter.get(INSTANCE_ID_KEY);
      if (existing) {
        this.cachedInstanceId = existing;
        return { instanceId: existing, isNew: false };
      }
      await this.storageAdapter.set(INSTANCE_ID_KEY, candidate, undefined, { nx: true });
      const settled = (await this.storageAdapter.get(INSTANCE_ID_KEY)) ?? candidate;
      this.cachedInstanceId = settled;
      return { instanceId: settled, isNew: settled === candidate };
    } catch {
      const fallback = randomUUID();
      this.cachedInstanceId = fallback;
      return { instanceId: fallback, isNew: true };
    }
  }

  /**
   * Build the telemetry payload from the resolved configuration and the
   * registered provider lists. Pure shape extraction — no values are read
   * beyond enums, booleans, and provider identifiers.
   */
  private buildPayload(event: 'boot' | 'heartbeat', instanceId: string): TelemetryPayload {
    const cfg = this.config;
    const nodeEnv =
      process.env.NODE_ENV === 'production'
        ? 'production'
        : process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined
          ? 'development'
          : 'other';

    let mfaProviders: string[] = [];
    try {
      mfaProviders = this.mfaService?.listProviders().providers ?? [];
    } catch {
      // Provider registry unavailable — report empty rather than fail.
    }
    let socialProviders: string[] = [];
    try {
      socialProviders = this.socialProviderRegistry?.listProviders() ?? [];
    } catch {
      // Provider registry unavailable — report empty rather than fail.
    }

    return {
      schemaVersion: 1,
      instanceId,
      event,
      coreVersion: getCoreVersion(),
      nodeMajor: parseInt(process.versions.node.split('.')[0], 10),
      platform: process.platform,
      arch: process.arch,
      nodeEnv,
      framework: this.framework,
      config: {
        tokenDeliveryMethod: cfg.tokenDelivery?.method ?? 'json',
        mfa: {
          enabled: cfg.mfa?.enabled === true,
          enforcement: cfg.mfa?.enforcement ?? null,
          gracePeriodSet: cfg.mfa?.gracePeriod !== undefined,
          allowedMethods: (cfg.mfa?.allowedMethods ?? []).map((m) => String(m)),
        },
        mfaProviders,
        socialProviders,
        storageAdapter: this.storageAdapter.constructor.name,
        signupVerificationMethod: cfg.signup?.verificationMethod ?? null,
        auditLogsEnabled: cfg.auditLogs?.enabled !== false,
        recaptchaEnabled: cfg.recaptcha?.enabled === true,
        geoLocationConfigured: cfg.geoLocation?.maxMind !== undefined,
      },
    };
  }

  /**
   * POST the payload to the telemetry endpoint with a hard timeout.
   * All failures are swallowed (debug log only) — telemetry must be
   * invisible when it fails.
   */
  private async send(payload: TelemetryPayload): Promise<void> {
    const endpoint = this.config.telemetry?.endpoint ?? DEFAULT_ENDPOINT;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    timeout.unref?.();
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger?.debug?.(`Telemetry send failed (ignored): ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
