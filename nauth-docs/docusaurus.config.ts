import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'nauth toolkit — Embedded Authentication for Node.js',
  tagline: 'Embedded TypeScript authentication for NestJS, Express, and Fastify.',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://nauth.dev',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',
  trailingSlash: false,

  customFields: {
    defaultAuthor: 'Admin',
    metaAuthor: 'Admin',
  },

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'Noorix Digital Solutions', // Usually your GitHub org/user name.
  projectName: 'nauth-toolkit', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  // i18n: {
  //   defaultLocale: 'en',
  //   locales: ['en'],
  // },

  markdown: {
    mermaid: true,
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
          createSitemapItems: async (params) => {
            const { defaultCreateSitemapItems, ...rest } = params;
            const items = await defaultCreateSitemapItems(rest);
            return items
              .filter((item) => !item.url.includes('/page/'))
              .map((item) => {
                const url = item.url;
                if (url.match(/\/(docs\/quick-start|docs\/guides|docs\/concepts|docs\/features)\//)) {
                  return { ...item, priority: 0.8 };
                }
                if (url.match(/\/docs\/api\/(core\/(dto|entities|enums)|.*\/dto)\//)) {
                  return { ...item, priority: 0.4 };
                }
                if (url.match(/\/docs\/(api|frontend-sdk)\//)) {
                  return { ...item, priority: 0.6 };
                }
                if (url === 'https://nauth.dev/' || url.endsWith('/docs/intro')) {
                  return { ...item, priority: 0.9 };
                }
                return item;
              });
          },
        },
        docs: {
          remarkPlugins: [[require('@docusaurus/remark-plugin-npm2yarn'), { sync: true }]],
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs', // Base URL for docs
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          showLastUpdateTime: true,
          showLastUpdateAuthor: false,
        },

        blog: false,

        googleTagManager: {
          containerId: 'GTM-MDBSGWPT',
        },

        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-blog',
      {
        id: 'changelog',
        routeBasePath: 'changelog',
        path: 'changelog',
        blogTitle: 'Changelog',
        blogDescription: 'nauth-toolkit release notes and changelog',
        blogSidebarTitle: 'Releases',
        blogSidebarCount: 'ALL',
        showReadingTime: false,
        feedOptions: {
          type: null,
        },
      },
    ],
    [
      'docusaurus-plugin-llms',
      {
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        docsDir: 'docs',
        title: 'nauth-toolkit',
        description:
          'Framework-agnostic authentication toolkit for Node.js. Supports NestJS, Express, and Fastify with MFA, social auth, and frontend SDKs.',
        excludeImports: true,
        removeDuplicateHeadings: true,
        rootContent: [
          'nauth-toolkit provides a framework-agnostic auth engine with adapters for NestJS, Express, and Fastify.',
          '',
          '## Section Files',
          'For targeted context, load the specific file instead of llms-full.txt:',
          '- /llms-guides.txt — Getting started, concepts, and how-to guides',
          '- /llms-api-core.txt — Core services, DTOs, enums, interfaces, hooks',
          '- /llms-api-adapters.txt — NestJS, Express, and Fastify framework adapters',
          '- /llms-api-providers.txt — MFA, social, email, SMS, database, and storage providers',
          '- /llms-frontend-sdk.txt — Client SDK for Angular, React, and mobile',
        ].join('\n'),
        includeOrder: [
          'intro.*',
          'quick-start/*',
          'concepts/*',
          'guides/**/*',
          'api/overview*',
          'api/core/services/*',
          'api/core/dto/*',
          'api/core/hooks/*',
          'api/core/enums/*',
          'api/core/interfaces/*',
          'api/core/exceptions/*',
          'api/core/utilities/*',
          'api/nestjs/**/*',
          'api/express/**/*',
          'api/fastify/**/*',
          'api/mfa/*',
          'api/social/*',
          'api/email/*',
          'api/sms/*',
          'api/database/*',
          'api/storage/*',
          'api/recaptcha/**/*',
          'frontend-sdk/overview*',
          'frontend-sdk/guides/*',
          'frontend-sdk/concepts/*',
          'frontend-sdk/api/**/*',
          'frontend-sdk/angular/*',
          'frontend-sdk/react/*',
          'frontend-sdk/mobile/*',
        ],
        customLLMFiles: [
          {
            filename: 'llms-guides.txt',
            includePatterns: ['concepts/**/*', 'guides/**/*', 'quick-start/**/*', 'intro.*'],
            fullContent: true,
            title: 'nauth-toolkit — Guides & Concepts',
            description:
              'Getting started guides, architecture concepts, and how-to guides for authentication, MFA, social login, and more.',
            orderPatterns: ['intro.*', 'quick-start/*', 'concepts/*', 'guides/*'],
          },
          {
            filename: 'llms-api-core.txt',
            includePatterns: ['api/core/**/*', 'api/overview*'],
            fullContent: true,
            title: 'nauth-toolkit — Core API Reference',
            description:
              'Core services (AuthService, MFAService, SocialAuthService), DTOs, enums, interfaces, hooks, and exceptions.',
            orderPatterns: [
              'api/overview*',
              'api/core/services/*',
              'api/core/dto/*',
              'api/core/hooks/*',
              'api/core/enums/*',
              'api/core/interfaces/*',
              'api/core/exceptions/*',
              'api/core/utilities/*',
            ],
          },
          {
            filename: 'llms-api-adapters.txt',
            includePatterns: ['api/nestjs/**/*', 'api/express/**/*', 'api/fastify/**/*'],
            fullContent: true,
            title: 'nauth-toolkit — Framework Adapters',
            description:
              'NestJS modules, guards, decorators, and interceptors. Express middleware and helpers. Fastify hooks and helpers.',
            orderPatterns: ['api/nestjs/**/*', 'api/express/**/*', 'api/fastify/**/*'],
          },
          {
            filename: 'llms-api-providers.txt',
            includePatterns: [
              'api/mfa/**/*',
              'api/social/**/*',
              'api/email/**/*',
              'api/sms/**/*',
              'api/database/**/*',
              'api/storage/**/*',
              'api/recaptcha/**/*',
            ],
            fullContent: true,
            title: 'nauth-toolkit — Provider Packages',
            description:
              'MFA (TOTP, SMS, Email, Passkey), social OAuth (Google, Apple, Facebook), email/SMS providers, database entities, and storage adapters.',
            orderPatterns: [
              'api/mfa/*',
              'api/social/*',
              'api/email/*',
              'api/sms/*',
              'api/database/*',
              'api/storage/*',
              'api/recaptcha/**/*',
            ],
          },
          {
            filename: 'llms-frontend-sdk.txt',
            includePatterns: ['frontend-sdk/**/*'],
            fullContent: true,
            title: 'nauth-toolkit — Frontend SDK',
            description:
              'Client SDK: NAuthClient API, Angular service and guards, React hooks, Capacitor mobile setup, social auth, and MFA flows.',
            orderPatterns: [
              'frontend-sdk/overview*',
              'frontend-sdk/guides/*',
              'frontend-sdk/concepts/*',
              'frontend-sdk/api/**/*',
              'frontend-sdk/angular/*',
              'frontend-sdk/react/*',
              'frontend-sdk/mobile/*',
            ],
          },
        ],
      },
    ],
  ],

  themes: [
    '@docusaurus/theme-mermaid',
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */
      {
        // ... Your options.
        // `hashed` is recommended as long-term-cache of index file is possible.
        hashed: true,

        // For Docs using Chinese, it is recomended to set:
        language: ['en'],

        // Customize the keyboard shortcut to focus search bar (default is "mod+k"):
        // searchBarShortcutKeymap: "s", // Use 'S' key
        // searchBarShortcutKeymap: "ctrl+shift+f", // Use Ctrl+Shift+F

        // If you're using `noIndex: true`, set `forceIgnoreNoIndex` to enable local index:
        // forceIgnoreNoIndex: true,
      },
    ],
  ],

  stylesheets: [
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossorigin: 'anonymous',
    },
    {
      rel: 'preconnect',
      href: 'https://kit.fontawesome.com',
    },
    {
      href: 'https://fonts.googleapis.com/css2?family=Red+Hat+Text:ital,wght@0,300..700;1,300..700&display=swap',
      type: 'text/css',
    },
  ],

  scripts: [
    {
      src: 'https://kit.fontawesome.com/d6545e9070.js',
      crossorigin: 'anonymous',
      async: true,
    },
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/nauth_square_text.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'nauth-toolkit',
      logo: {
        alt: 'nauth-toolkit Logo',
        src: 'img/nauth_square_logoonly.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        // Guides sidebar - coming soon
        // {
        //   type: 'docSidebar',
        //   sidebarId
        // : 'guidesSidebar',
        //   position: 'left',
        //   label: 'Guides',
        // },
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API Reference',
        },
        {
          type: 'docSidebar',
          sidebarId: 'frontendSdkSidebar',
          position: 'left',
          label: 'Frontend SDK',
        },

        {
          to: '/changelog',
          label: 'Changelog',
          position: 'left',
        },
        {
          href: 'https://demo.nauth.dev',
          label: 'Live Demo',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/@nauth-toolkit/core',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',

      copyright: `Copyright © ${new Date().getFullYear()} nauth-toolkit. MIT License`,
    },
    prism: {
      theme: prismThemes.nightOwl,
      darkTheme: prismThemes.nightOwl,
      additionalLanguages: ['bash', 'typescript', 'javascript', 'json'],
    },

    // Algolia DocSearch configuration (enable when credentials are available)
    // algolia: {
    //   appId: process.env.ALGOLIA_APP_ID || 'YOUR_APP_ID',
    //   apiKey: process.env.ALGOLIA_API_KEY || 'YOUR_SEARCH_API_KEY',
    //   indexName: 'nauth-toolkit',
    //   contextualSearch: true,
    // },
  } satisfies Preset.ThemeConfig,
};

export default config;
