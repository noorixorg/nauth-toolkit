import React, { useState, useEffect } from 'react';
import Link from '@docusaurus/Link';
import '../css/homepage.css';

// ─── TypewriterCode ───────────────────────────────────────────────────────────
const TypewriterCode = ({ code }: { code: string[] }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);

  useEffect(() => {
    const currentCommand = code[currentCommandIndex];
    if (currentIndex < currentCommand.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(currentCommand.substring(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 28);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setCurrentIndex(0);
        setDisplayedText('');
        setCurrentCommandIndex((currentCommandIndex + 1) % code.length);
      }, 4000);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, currentCommandIndex, code]);

  const highlightLine = (line: string) => {
    if (line.trim().startsWith('#')) return <span style={{ color: '#8b949e' }}>{line}</span>;
    if (line.includes('npm install')) return <span style={{ color: '#f0f6fc', fontWeight: 600 }}>{line}</span>;
    const keywords = ['import', 'export', 'async', 'const', 'class', 'function', 'return', 'from'];
    const hasKeyword = keywords.some((kw) => line.trim().startsWith(kw) || line.includes(` ${kw} `));
    if (hasKeyword) return <span style={{ color: '#c792ea', fontWeight: 500 }}>{line}</span>;
    if (line.trim().startsWith('@')) return <span style={{ color: '#ffcb6b', fontWeight: 500 }}>{line}</span>;
    return <span style={{ color: '#f0f6fc', fontWeight: 500 }}>{line}</span>;
  };

  return (
    <code className="typewriter-code">
      {displayedText.split('\n').map((line, idx) => (
        <div key={idx}>{highlightLine(line)}</div>
      ))}
      <span className="cursor-blink" />
    </code>
  );
};

// ─── CodeTabs ─────────────────────────────────────────────────────────────────
const CodeTabs = () => {
  const [activeTab, setActiveTab] = useState<'nestjs' | 'express' | 'fastify'>('nestjs');

  const nestjsCode = [
    `# Install NestJS adapter
npm install @nauth-toolkit/nestjs \\
  @nauth-toolkit/database-typeorm-postgres`,
    `@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }
}`,
  ];

  const expressCode = [
    `# Install core package
npm install @nauth-toolkit/core \\
  @nauth-toolkit/database-typeorm-postgres`,
    `import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
});

app.use(nauth.middleware.clientInfo);
app.use(nauth.middleware.auth);
app.use(nauth.middleware.tokenDelivery);

app.post('/signup', nauth.helpers.public(),
  async (req, res) => {
    res.json(await nauth.authService.signup(req.body));
  });`,
  ];

  const fastifyCode = [
    `# Install core package
npm install @nauth-toolkit/core \\
  @nauth-toolkit/database-typeorm-postgres`,
    `import { NAuth, FastifyAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new FastifyAdapter(),
});

fastify.addHook('onRequest', nauth.middleware.clientInfo);
fastify.addHook('onRequest', nauth.middleware.auth);
fastify.addHook('onSend', nauth.middleware.tokenDelivery);

fastify.post('/signup',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req) =>
    nauth.authService.signup(req.body)));`,
  ];

  const labels: Record<'nestjs' | 'express' | 'fastify', string> = {
    nestjs: 'NestJS',
    express: 'Express',
    fastify: 'Fastify',
  };

  return (
    <div className="code-tabs-container">
      <div className="tabs-header">
        {(['nestjs', 'express', 'fastify'] as const).map((tab) => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {labels[tab]}
          </button>
        ))}
      </div>
      <div className="code-terminal-large">
        <div className="terminal-header">
          <div className="terminal-dot terminal-dot-red"></div>
          <div className="terminal-dot terminal-dot-yellow"></div>
          <div className="terminal-dot terminal-dot-green"></div>
        </div>
        <TypewriterCode
          key={activeTab}
          code={activeTab === 'nestjs' ? nestjsCode : activeTab === 'express' ? expressCode : fastifyCode}
        />
      </div>
    </div>
  );
};

// ─── Home Page ────────────────────────────────────────────────────────────────
// ─── Step data ────────────────────────────────────────────────────────────────
const backendData = {
  nestjs: {
    label: 'NestJS',
    bullets: [
      'Drop-in DynamicModule — AuthModule.forRoot()',
      '@Public(), @CurrentUser(), @ClientInfo() decorators',
      'AuthGuard and CsrfGuard ready to use',
      'Interceptors handle cookie token delivery automatically',
    ],
  },
  express: {
    label: 'Express',
    bullets: [
      "Three middleware lines and you're wired up",
      'requireAuth() helper protects any route',
      'Drops into any existing Express app as-is',
      'No project restructuring required',
    ],
  },
  fastify: {
    label: 'Fastify',
    bullets: [
      'FastifyAdapter with preHandler hook support',
      'Works alongside all existing Fastify plugins',
      'Same core engine — just a different adapter',
      'Cookie and JSON token delivery both supported',
    ],
  },
} as const;

const frontendData = {
  angular: {
    label: 'Angular',
    bullets: [
      'NAuthModule integrates with Angular DI',
      'AuthService, AuthGuard, and HTTP interceptor included',
      'Automatic silent token refresh in the background',
      'Lazy-loadable — ships only what your app uses',
    ],
  },
  react: {
    label: 'React',
    bullets: [
      'useAuth(), useSignup(), useMFA() hooks',
      'AuthProvider wraps your app in one line',
      'Handles token refresh and session state for you',
      'Full TypeScript support throughout',
    ],
  },
  custom: {
    label: 'Custom',
    bullets: [
      'Plain REST API — any frontend stack works',
      'Documented JSON request/response shapes',
      'No SDK dependency required',
      'OpenAPI schema available for client codegen',
    ],
  },
} as const;

function ColorModeToggle(): React.ReactElement {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  const toggle = (): void => {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
    setIsDark(!isDark);
  };

  return (
    <button
      className="nav-theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <i className="fa-light fa-moon"></i> : <i className="fa-light fa-sun"></i>}
    </button>
  );
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backendTab, setBackendTab] = useState<keyof typeof backendData>('nestjs');
  const [frontendTab, setFrontendTab] = useState<keyof typeof frontendData>('angular');

  // Scroll-reveal: add .visible when .anim-reveal enters the viewport
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.anim-reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'nauth-toolkit',
    description:
      'Framework-agnostic authentication toolkit for Node.js. Embedded TypeScript library for NestJS, Express and Fastify — no external services, no per-user fees.',
    url: 'https://nauth.dev',
    image: 'https://nauth.dev/img/nauth_square_text.png',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'OS Independent',
    programmingLanguage: 'TypeScript',
    license: 'https://nauth.dev/docs/license',
    codeRepository: 'https://github.com/noorixorg/nauth',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <div className="homepage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="homepage-nav">
        <div className="nav-content">
          <Link to="/" className="nav-logo" onClick={() => setMobileMenuOpen(false)}>
            <img src="/img/nauth_square_logoonly.png" alt="nauth-toolkit logo" width="28" height="28" />
            <span>nauth-toolkit</span>
          </Link>
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
          <div className={`nav-right ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <Link to="/docs/intro" onClick={() => setMobileMenuOpen(false)}>
              Docs
            </Link>
            <Link to="/docs/api/overview" onClick={() => setMobileMenuOpen(false)}>
              API Reference
            </Link>
            <Link to="/docs/frontend-sdk/overview" onClick={() => setMobileMenuOpen(false)}>
              Frontend SDK
            </Link>
            <a
              href="https://github.com/noorixorg/nauth"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
            >
              GitHub
            </a>
            <ColorModeToggle />
            <a
              className="nav-npm-badge"
              href="https://www.npmjs.com/package/@nauth-toolkit/core"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
            >
              npm
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              Early Access &middot; Transitioning to Open Source
            </div>
            <h1 className="hero-headline">
              Authentication that lives
              <br />
              <span className="headline-gradient">in your codebase.</span>
            </h1>
            <p className="hero-subtitle">
              An embedded TypeScript library for NestJS, Express &amp; Fastify. Runs in your server, stores data in your
              database. Free to use.
            </p>
            <div className="hero-buttons">
              <Link className="btn btn-primary" to="/docs/intro">
                Get Started
              </Link>
              <Link className="btn btn-ghost" to="/docs/quick-start/nestjs">
                Quick Start
              </Link>
            </div>
          </div>
          <div className="hero-code">
            <CodeTabs />
          </div>
        </div>

        <div className="frameworks-strip">
          <span className="frameworks-label">Works with</span>
          <div className="frameworks-list">
            <span className="framework-badge">
              <i className="fa-kit fa-nestjs-light"></i> NestJS
            </span>
            <span className="framework-badge">
              <i className="fa-light fa-cube"></i> Express
            </span>
            <span className="framework-badge">
              <i className="fa-light fa-bolt"></i> Fastify
            </span>
            <span className="framework-badge">
              <i className="fa-brands fa-angular"></i> Angular
            </span>
            <span className="framework-badge">
              <i className="fa-brands fa-react"></i> React
            </span>
          </div>
        </div>
      </section>

      {/* ── Value Props ────────────────────────────────────────────────── */}
      <div className="stats-strip">
        <div className="stats-strip-inner">
          <div className="value-item">
            <i className="fa-duotone fa-light fa-circle-dollar-to-slot value-icon"></i>
            <div className="value-text">
              <span className="value-title">No per-user fees</span>
              <span className="value-desc">Auth is infrastructure — not a metered API service.</span>
            </div>
          </div>
          <div className="stat-div"></div>
          <div className="value-item">
            <i className="fa-duotone fa-light fa-database value-icon"></i>
            <div className="value-text">
              <span className="value-title">Your database</span>
              <span className="value-desc">All user data stays in your PostgreSQL or MySQL.</span>
            </div>
          </div>
          <div className="stat-div"></div>
          <div className="value-item">
            <i className="fa-duotone fa-light fa-file-code value-icon"></i>
            <div className="value-text">
              <span className="value-title">Full TypeScript source</span>
              <span className="value-desc">Read, modify, and fork every line. No black boxes.</span>
            </div>
          </div>
          <div className="stat-div"></div>
          <div className="value-item">
            <i className="fa-duotone fa-light fa-server value-icon"></i>
            <div className="value-text">
              <span className="value-title">Embedded, not external</span>
              <span className="value-desc">Runs inside your process. Zero external API calls.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Auth Capabilities ──────────────────────────────────────────── */}
      <section className="capabilities-section">
        <div className="section-container">
          <div className="section-header">
            <h2>Everything authentication needs</h2>
            <p>
              From simple email/password signup to adaptive multi-factor authentication — all in one library, all fully
              under your control.
            </p>
          </div>
          <div className="capabilities-grid">
            <div className="capability-card anim-reveal">
              <div className="capability-icon-wrap">
                <i className="fa-duotone fa-light fa-right-to-bracket"></i>
              </div>
              <h3>Email &amp; Password</h3>
              <ul>
                <li>Signup with email or phone number</li>
                <li>Configurable password policies</li>
                <li>Email &amp; phone verification</li>
                <li>Forgot password &amp; change password</li>
                <li>Account lockout &amp; rate limiting</li>
                <li>Username-based login support</li>
              </ul>
              <Link to="/docs/guides/basic-auth" className="capability-link">
                View guide <i className="fa-light fa-arrow-right"></i>
              </Link>
            </div>

            <div className="capability-card anim-reveal">
              <div className="capability-icon-wrap">
                <i className="fa-duotone fa-light fa-share-nodes"></i>
              </div>
              <h3>Social Login</h3>
              <ul>
                <li>Google OAuth 2.0</li>
                <li>Apple Sign In</li>
                <li>Facebook Login</li>
                <li>Web redirect flows</li>
                <li>Native mobile token flows</li>
                <li>Account linking</li>
              </ul>
              <Link to="/docs/guides/social/how-social-login-works" className="capability-link">
                View guide <i className="fa-light fa-arrow-right"></i>
              </Link>
            </div>

            <div className="capability-card anim-reveal">
              <div className="capability-icon-wrap">
                <i className="fa-duotone fa-light fa-shield-halved"></i>
              </div>
              <h3>Multi-Factor Auth</h3>
              <ul>
                <li>TOTP (Google Authenticator, Authy)</li>
                <li>SMS verification codes</li>
                <li>Email OTP</li>
                <li>WebAuthn / Passkeys (Face ID, YubiKey)</li>
                <li>Adaptive MFA by login risk</li>
                <li>Trusted device management</li>
              </ul>
              <Link to="/docs/guides/mfa/how-mfa-works" className="capability-link">
                View guide <i className="fa-light fa-arrow-right"></i>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <section className="how-section">
        <div className="section-container">
          <div className="section-header">
            <h2>Up and running in three steps</h2>
            <p>Add complete auth to your existing Node.js app without restructuring your project.</p>
          </div>
          <div className="steps-grid">
            {/* Step 1 — Backend framework */}
            <div className="step-card step-card-tall">
              <div className="step-num">1</div>
              <h3>Install for your backend</h3>
              <p>Pick your framework — the same auth engine powers all three.</p>
              <div className="step-tabs">
                {(Object.keys(backendData) as Array<keyof typeof backendData>).map((k) => (
                  <button
                    key={k}
                    className={`step-tab ${backendTab === k ? 'active' : ''}`}
                    onClick={() => setBackendTab(k)}
                  >
                    {backendData[k].label}
                  </button>
                ))}
              </div>
              <ul className="step-bullets">
                {(backendData[backendTab].bullets as readonly string[]).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>

            <div className="step-arrow">
              <i className="fa-light fa-arrow-right"></i>
            </div>

            {/* Step 2 — Configure + routes */}
            <div className="step-card step-card-tall">
              <div className="step-num">2</div>
              <h3>Configure and build routes</h3>
              <p>
                One TypeScript config drives every auth behavior. Wire up routes by calling service methods from your
                own controllers.
              </p>
              <ul className="step-bullets">
                <li>Signup, login, email verification, password reset</li>
                <li>MFA enforcement, session policies, token delivery</li>
                <li>Social OAuth redirect and callback handling</li>
                <li>No magic endpoints — you own the entire API surface</li>
                <li>Lifecycle hooks to extend any flow without forking</li>
              </ul>
            </div>

            <div className="step-arrow">
              <i className="fa-light fa-arrow-right"></i>
            </div>

            {/* Step 3 — Frontend SDK */}
            <div className="step-card step-card-tall">
              <div className="step-num">3</div>
              <h3>Connect your frontend</h3>
              <p>Use a ready-made SDK or call the REST API directly from any framework.</p>
              <div className="step-tabs">
                {(Object.keys(frontendData) as Array<keyof typeof frontendData>).map((k) => (
                  <button
                    key={k}
                    className={`step-tab ${frontendTab === k ? 'active' : ''}`}
                    onClick={() => setFrontendTab(k)}
                  >
                    {frontendData[k].label}
                  </button>
                ))}
              </div>
              <ul className="step-bullets">
                {(frontendData[frontendTab].bullets as readonly string[]).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="features-section">
        <div className="section-container">
          <div className="section-header">
            <h2>Enterprise features</h2>
            <p>Security-first architecture with all the infrastructure you need to ship authentication.</p>
          </div>
          <div className="features-grid">
            <div className="feature-tile anim-reveal">
              <i className="fa-duotone fa-light fa-layer-group feature-tile-icon"></i>
              <h3>Platform-Agnostic Core</h3>
              <p>
                Pure TypeScript with zero framework dependencies. The same core powers NestJS, Express, and Fastify.
              </p>
            </div>
            <div className="feature-tile anim-reveal">
              <i className="fa-duotone fa-light fa-arrows-rotate feature-tile-icon"></i>
              <h3>Challenge-Based Architecture</h3>
              <p>
                A unified challenge/response loop handles email verification, MFA, and password changes — one endpoint,
                all flows.
              </p>
            </div>
            <div className="feature-tile anim-reveal">
              <i className="fa-duotone fa-light fa-lock feature-tile-icon"></i>
              <h3>Production Security</h3>
              <p>
                Argon2id hashing, JWT with RS256/HS256, CSRF protection, refresh token rotation with reuse detection.
              </p>
            </div>
            <div className="feature-tile anim-reveal">
              <i className="fa-duotone fa-light fa-brain-circuit feature-tile-icon"></i>
              <h3>Adaptive MFA</h3>
              <p>
                Risk-based MFA enforcement triggered by login context — new device, location change, or anomalous
                patterns.
              </p>
            </div>
            <div className="feature-tile anim-reveal">
              <i className="fa-duotone fa-light fa-clipboard-list-check feature-tile-icon"></i>
              <h3>Audit Trail</h3>
              <p>Comprehensive structured logging for logins, MFA events, password changes, and security incidents.</p>
            </div>
            <div className="feature-tile anim-reveal">
              <i className="fa-duotone fa-light fa-gauge-high feature-tile-icon"></i>
              <h3>Rate Limiting &amp; Lockouts</h3>
              <p>
                Per-IP and per-user request limits with configurable account lockout policies and automatic unlocking.
              </p>
            </div>
            <div className="feature-tile anim-reveal">
              <i className="fa-duotone fa-light fa-location-dot feature-tile-icon"></i>
              <h3>IP Geolocation</h3>
              <p>
                Track login locations with MaxMind GeoIP2. Surface location data in security events and trusted device
                flows.
              </p>
            </div>
            <div className="feature-tile anim-reveal">
              <i className="fa-duotone fa-light fa-server feature-tile-icon"></i>
              <h3>Flexible Storage</h3>
              <p>
                In-memory for dev, database-backed for low-traffic, or Redis with cluster support for production scale.
              </p>
            </div>
            <div className="feature-tile anim-reveal">
              <i className="fa-duotone fa-light fa-webhook feature-tile-icon"></i>
              <h3>Lifecycle Hooks</h3>
              <p>
                Extensible hooks at signup, login, MFA triggers, and sign-in blocks. Customize any flow without forking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Config Showcase ────────────────────────────────────────────── */}
      <section className="code-section">
        <div className="section-container">
          <div className="section-header section-header-dark">
            <h2>One config. Everything else bootstraps.</h2>
            <p>
              Define your auth policy in a single TypeScript object. nauth-toolkit reads it at startup and wires up
              every service, middleware, and flow automatically.
            </p>
          </div>
          <div className="config-showcase">
            <div className="config-code-panel">
              <div className="config-file-tab">
                <i className="fa-light fa-file-code"></i> auth.config.ts
              </div>
              <pre className="config-pre">
                <code>{`export const authConfig: NAuthConfig = {
  signup: {
    requireEmailVerification: true,
    allowedIdentifiers: ['email', 'username'],
  },

  mfa: {
    enabled: true,
    enforcement: 'OPTIONAL',
    allowedMethods: [
      MFAMethod.TOTP,
      MFAMethod.EMAIL,
      MFAMethod.SMS,
      MFAMethod.PASSKEY,
    ],
    rememberDeviceDays: 30,
  },

  social: {
    google:   { clientId: '...', clientSecret: '...' },
    apple:    { clientId: '...', teamId: '...' },
    facebook: { appId: '...',    appSecret: '...' },
  },

  session: {
    maxActiveSessions: 5,
    revokeOnPasswordChange: true,
  },

  rateLimit: {
    login:  { maxAttempts: 5,  windowMs: 900_000 },
    signup: { maxAttempts: 10, windowMs: 3_600_000 },
  },

  tokenDelivery: { mode: 'cookie' },
};`}</code>
              </pre>
            </div>
            <div className="config-bootstraps">
              <p className="bootstraps-label">From this config, nauth-toolkit bootstraps:</p>
              <ul className="bootstraps-list">
                <li>
                  <i className="fa-light fa-check"></i> Signup, login, email &amp; phone verification
                </li>
                <li>
                  <i className="fa-light fa-check"></i> Forgot password &amp; change password flows
                </li>
                <li>
                  <i className="fa-light fa-check"></i> TOTP, SMS, Email OTP &amp; Passkey MFA
                </li>
                <li>
                  <i className="fa-light fa-check"></i> Google, Apple &amp; Facebook OAuth
                </li>
                <li>
                  <i className="fa-light fa-check"></i> Session management &amp; revocation
                </li>
                <li>
                  <i className="fa-light fa-check"></i> Per-IP &amp; per-user rate limiting
                </li>
                <li>
                  <i className="fa-light fa-check"></i> Refresh token rotation &amp; reuse detection
                </li>
                <li>
                  <i className="fa-light fa-check"></i> HttpOnly cookie delivery with CSRF guard
                </li>
                <li>
                  <i className="fa-light fa-check"></i> Audit log for every security event
                </li>
              </ul>
              <div className="bootstraps-note">
                Your routes stay thin — call <code>authService.signup(dto)</code>, get a result. You configure what
                routes to expose and add custom logic as needed.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why nauth ──────────────────────────────────────────────────── */}
      <section className="why-section">
        <div className="section-container">
          <div className="section-header">
            <h2>Why use nauth</h2>
            <p>
              Authentication is infrastructure — it deserves the same control and visibility as your database or API
              layer.
            </p>
          </div>
          <div className="why-grid">
            <div className="why-card anim-reveal">
              <div className="why-icon-wrap why-icon-gain">
                <i className="fa-duotone fa-light fa-circle-check"></i>
              </div>
              <h3>What you gain</h3>
              <ul className="why-list">
                <li>Complete control over code and data</li>
                <li>No vendor lock-in or usage-based pricing</li>
                <li>Customize every flow without limitations</li>
                <li>All user data stays in your own database</li>
                <li>No additional monthly costs as you scale</li>
              </ul>
            </div>

            <div className="why-card anim-reveal">
              <div className="why-icon-wrap why-icon-when">
                <i className="fa-duotone fa-light fa-bullseye-arrow"></i>
              </div>
              <h3>When to choose nauth</h3>
              <ul className="why-list">
                <li>Need full control over auth logic and data flows</li>
                <li>Want predictable infrastructure costs</li>
                <li>Require deep customization of signup or login flows</li>
                <li>Building on Node.js — NestJS, Express, or Fastify</li>
                <li>Prefer owning and auditing your security code directly</li>
              </ul>
            </div>

            <div className="why-card anim-reveal">
              <div className="why-icon-wrap why-icon-trade">
                <i className="fa-duotone fa-light fa-scale-balanced"></i>
              </div>
              <h3>Trade-offs to consider</h3>
              <ul className="why-list why-list-muted">
                <li>You manage infrastructure and security audits</li>
                <li>No managed compliance certifications (HIPAA, SOC 2)</li>
                <li>Limited to the Node.js ecosystem</li>
              </ul>
              <p className="why-card-note">
                If managed compliance or a non-Node.js stack is required, a SaaS auth provider may be a better fit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2>Start building today</h2>
          <p className="cta-description">
            Add complete authentication to your Node.js application — social login, adaptive MFA, passkeys, and full
            audit trails. No third-party services, no per-user fees, no vendor lock-in.
          </p>
          <div className="button-group">
            <Link className="btn btn-primary" to="/docs/intro">
              Read the Docs
            </Link>
            <Link className="btn btn-ghost" to="/docs/quick-start/nestjs">
              Quick Start
            </Link>
          </div>
          <div className="cta-links">
            <a href="https://github.com/noorixorg/nauth" target="_blank" rel="noopener noreferrer" className="cta-link">
              <i className="fa-brands fa-github"></i>
              Sample apps &amp; community
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="homepage-footer">
        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} nauth-toolkit &middot;{' '}
          <a href="/docs/license" className="footer-license-link">
            Early Access License
          </a>
        </div>
      </footer>
    </div>
  );
}
