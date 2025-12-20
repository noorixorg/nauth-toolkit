import React, { useState, useEffect } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import '../css/homepage.css';
import FeatureCard from '../components/FeatureCard';

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
      }, 30);
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
    // Comments - brighter gray for readability
    if (line.trim().startsWith('#')) {
      return <span style={{ color: '#8b949e', opacity: 1 }}>{line}</span>;
    }

    // npm install commands - make them very bright and readable
    if (line.includes('npm install')) {
      return <span style={{ color: '#f0f6fc', fontWeight: 600 }}>{line}</span>;
    }

    // Keywords (import, export, async, const, class, etc.) - bright purple
    const keywords = ['import', 'export', 'async', 'const', 'class', 'function', 'return', 'from'];
    const hasKeyword = keywords.some((kw) => line.trim().startsWith(kw) || line.includes(` ${kw} `));
    if (hasKeyword) {
      return <span style={{ color: '#c792ea', fontWeight: 500 }}>{line}</span>;
    }

    // Decorators (@Module, @Controller, @Post, etc.) - bright orange/yellow
    if (line.trim().startsWith('@')) {
      return <span style={{ color: '#ffcb6b', fontWeight: 500 }}>{line}</span>;
    }

    // Default - bright Night Owl text
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

const CodeTabs = () => {
  const [activeTab, setActiveTab] = useState<'nestjs' | 'express' | 'fastify'>('nestjs');

  const nestjsCode = [
    `# Install NestJS adapter
npm install @nauth-toolkit/nestjs \\
  @nauth-toolkit/database-typeorm-postgres
import { AuthService, Public } from '@nauth-toolkit/nestjs';`,

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

  return (
    <div className="code-tabs-container">
      <div className="tabs-header">
        <button
          className={`tab-button ${activeTab === 'nestjs' ? 'active' : ''}`}
          onClick={() => setActiveTab('nestjs')}
        >
          NestJS
        </button>
        <button
          className={`tab-button ${activeTab === 'express' ? 'active' : ''}`}
          onClick={() => setActiveTab('express')}
        >
          Express
        </button>
        <button
          className={`tab-button ${activeTab === 'fastify' ? 'active' : ''}`}
          onClick={() => setActiveTab('fastify')}
        >
          Fastify
        </button>
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

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="homepage">
      {/* Navigation */}
      <nav className="homepage-nav">
        <div className="nav-content">
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
          <div className={`nav-right ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <Link to="/docs/intro" onClick={() => setMobileMenuOpen(false)}>DOCS</Link>
            <Link to="/docs/api/overview" onClick={() => setMobileMenuOpen(false)}>API REFERENCE</Link>
            <Link to="/docs/frontend-sdk/overview" onClick={() => setMobileMenuOpen(false)}>FRONTEND SDK</Link>
            <Link to="/github" onClick={() => setMobileMenuOpen(false)}>SOURCE (COMING SOON)</Link>
            <a href="https://www.npmjs.com/package/@nauth-toolkit/core" target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)}>
              NPM
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-left">
            <img src="/img/nauth_square_text.png" alt="nauth-toolkit" />
            <p className="hero-subtitle">Platform-Agnostic Authentication Toolkit for Node.js</p>
            <div className="button-group">
              <Link className="btn btn-primary" to="/docs/intro">
                Get Started
              </Link>
              <a className="btn btn-secondary" href="https://www.npmjs.com/package/@nauth-toolkit/core" target="_blank" rel="noopener noreferrer">
                View on npm
              </a>
            </div>
          </div>
          <div className="hero-right">
            <CodeTabs />
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="content-section">
        <h2 className="section-title">Complete authentication without vendor lock-in</h2>
        <p className="section-description">
          Install directly into your application. Create auth tables in your database. Run auth logic in your server.
          Full control over code, data, and deployment.
        </p>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-number">18</span>
            <div className="stat-label">Packages</div>
          </div>
          <div className="stat-card">
            <span className="stat-number">Zero</span>
            <div className="stat-label">External Services</div>
          </div>
          <div className="stat-card">
            <span className="stat-number">100%</span>
            <div className="stat-label">TypeScript</div>
          </div>
          <div className="stat-card">
            <span className="stat-number">Open</span>
            <div className="stat-label">Source</div>
          </div>
        </div>

        <div className="feature-grid">
          <FeatureCard
            icon="fa-duotone fa-layer-group"
            heading="Platform-Agnostic Core"
            description="Pure TypeScript with zero framework dependencies. Works with NestJS, Express, Fastify, or any Node.js framework."
          />

          <FeatureCard
            icon="fa-duotone fa-check-double"
            heading="Complete Feature Set"
            description="Email/password, social login (Google, Apple, Facebook), MFA (TOTP, SMS, Passkey), sessions, verification, and audit logging."
          />

          <FeatureCard
            icon="fa-duotone fa-shield-halved"
            heading="Production Security"
            description="Argon2id hashing, JWT with configurable algorithms, CSRF protection, rate limiting, distributed locks, and adaptive MFA."
          />

          <FeatureCard
            icon="fa-duotone fa-database"
            heading="Database Integration"
            description="TypeORM adapters for PostgreSQL and MySQL. Auth tables in your database. No external data storage."
          />

          <FeatureCard
            icon="fa-duotone fa-server"
            heading="Flexible Storage"
            description="In-memory (dev), database (low-traffic), or Redis with cluster support (production). All implement the same interface."
          />

          <FeatureCard
            icon="fa-duotone fa-cubes"
            heading="Modular Architecture"
            description="Install only what you need. Each feature is a separate package. Start minimal, add features incrementally."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2>Start building in minutes</h2>
        <p className="cta-description">
          Add complete authentication to your Node.js application with minimal configuration. Social login, MFA with
          adaptive security, and audit trails - all without vendor lock-in.
        </p>
        <div className="button-group">
          <Link className="btn btn-secondary" to="/docs/intro">
            See Docs
          </Link>
          <a className="btn btn-secondary" href="https://www.npmjs.com/package/@nauth-toolkit/core">
            View on npm
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="homepage-footer">
        <div className="footer-bottom">
          Copyright © {new Date().getFullYear()} nauth-toolkit. Built with Docusaurus.
        </div>
      </footer>
    </div>
  );
}
