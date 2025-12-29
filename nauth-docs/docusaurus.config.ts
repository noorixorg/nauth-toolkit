import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'nauth-toolkit',
  tagline: 'Platform-Agnostic Authentication Toolkit for Node.js',
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

  customFields: {
    defaultAuthor: 'Murtaza Nooruddin',
    metaAuthor: 'Murtaza Nooruddin',
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
            return items.filter((item) => !item.url.includes('/page/'));
          },
        },
        docs: {
          remarkPlugins: [[require('@docusaurus/remark-plugin-npm2yarn'), { sync: true }]],
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs', // Base URL for docs
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },

        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
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

  scripts: [
    {
      src: 'https://kit.fontawesome.com/d6545e9070.js',
      crossorigin: 'anonymous',
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
          label: 'Guides',
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
          href: 'https://www.npmjs.com/package/@nauth-toolkit/core',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',

      copyright: `Copyright © ${new Date().getFullYear()} nauth-toolkit by Murtaza Nooruddin. Early Access License - transitioning to open source.`,
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
