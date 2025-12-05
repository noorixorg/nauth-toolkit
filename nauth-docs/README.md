# nauth-toolkit Documentation

This is the official documentation for **nauth-toolkit** - a platform-agnostic authentication toolkit for Node.js applications.

## Quick Start

```bash
# Install dependencies
cd nauth-docs
yarn install

# Start development server
yarn start

# Build for production
yarn build

# Serve built site locally
yarn serve
```

## Documentation Structure

The documentation is organized into three main sections:

### 1. **Docs** - Core Documentation

- Introduction & Philosophy
- Quick Start Guides (NestJS, Express, Fastify)
- Core Concepts & Architecture
- Framework Integration Guides
- Authentication Features
- MFA & Security
- Database & Storage Adapters
- Configuration & Deployment

### 2. **Guides** - Recipes & Tutorials

- Frontend Integration (Angular, React, Vue, Mobile)
- Common Patterns & Recipes
- Migration Guides
- Testing Strategies
- Complete Tutorials

### 3. **API** - API Reference

- Core Services
- NestJS-Specific APIs
- DTOs & Interfaces
- Entities & Enums

## Project Structure

```
nauth-docs/
├── docs/                    # Documentation content (Markdown/MDX)
│   ├── introduction/
│   ├── quick-start/
│   ├── concepts/
│   ├── frameworks/
│   ├── authentication/
│   ├── mfa/
│   ├── sessions/
│   ├── database/
│   ├── storage/
│   ├── providers/
│   ├── security/
│   ├── geolocation/
│   ├── configuration/
│   ├── deployment/
│   ├── frontend/
│   ├── recipes/
│   ├── testing/
│   ├── tutorials/
│   └── api/
├── blog/                    # Blog posts
├── src/                     # Custom React components
│   ├── components/
│   ├── css/
│   └── pages/
├── static/                  # Static assets
│   └── img/
├── docusaurus.config.ts    # Docusaurus configuration
├── sidebars.ts             # Sidebar structure
└── package.json
```

## Writing Documentation

### Creating New Pages

1. Create a new Markdown file in the appropriate `docs/` subdirectory
2. Add frontmatter at the top:

```markdown
---
sidebar_position: 1
title: Page Title
description: Brief description for SEO
---

# Page Title

Content goes here...
```

3. The page will automatically appear in the sidebar based on the structure defined in `sidebars.ts`

### Using MDX Features

MDX allows you to use React components in Markdown:

```mdx
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="nestjs" label="NestJS" default>
    NestJS example code...
  </TabItem>
  <TabItem value="express" label="Express">
    Express example code...
  </TabItem>
</Tabs>
```

### Code Blocks

Use language-specific syntax highlighting:

````markdown
```typescript
import { AuthModule } from '@nauth-toolkit/nestjs';

@Module({
  imports: [AuthModule.forRoot(config)],
})
export class AppModule {}
```
````

### Admonitions

Use admonitions for important notes:

```markdown
:::tip
This is a helpful tip!
:::

:::warning
This is a warning!
:::

:::danger
This is dangerous!
:::

:::info
This is informational.
:::
```

## Customization

### Theme Configuration

Edit `docusaurus.config.ts` to customize:

- Site title, tagline, favicon
- Navbar links
- Footer content
- Theme colors (in `src/css/custom.css`)
- Search configuration (Algolia DocSearch)

### Custom Components

Create React components in `src/components/` and use them in MDX files:

```tsx
// src/components/FeatureCard.tsx
export default function FeatureCard({ title, description }) {
  return (
    <div className="feature-card">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
```

```mdx
<!-- docs/some-page.mdx -->

import FeatureCard from '@site/src/components/FeatureCard';

<FeatureCard title="Platform-Agnostic" description="Works with any Node.js framework" />
```

## Search

The site is configured for Algolia DocSearch. To enable:

1. Apply for DocSearch at https://docsearch.algolia.com/apply/
2. Update `algolia` config in `docusaurus.config.ts` with your credentials
3. Search will automatically work once approved

## Versioning

To create a new version:

```bash
yarn docusaurus docs:version 1.0.0
```

This creates:

- `versioned_docs/version-1.0.0/` - Frozen snapshot of docs
- `versioned_sidebars/version-1.0.0-sidebars.json` - Frozen sidebar
- Entry in `versions.json`

Users can switch between versions using the dropdown in the navbar.

## Deployment

### GitHub Pages

1. Update `docusaurus.config.ts`:

```ts
url: 'https://your-org.github.io',
baseUrl: '/nauth-toolkit/',
organizationName: 'your-org',
projectName: 'nauth-toolkit',
```

2. Deploy:

```bash
yarn deploy
```

### Vercel / Netlify

1. Connect your repository
2. Set build command: `yarn build`
3. Set output directory: `build`
4. Deploy automatically on push

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build
EXPOSE 3000
CMD ["yarn", "serve", "--host", "0.0.0.0"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally: `yarn start`
5. Submit a pull request

### Documentation Guidelines

- Use clear, concise language
- Include code examples for all features
- Add comparison tables where helpful
- Use proper heading hierarchy (H2 → H3 → H4)
- Add cross-references between related pages
- Test all code examples before committing
- Follow the existing structure and style

## License

MIT

## Links

- **Main Repository**: https://github.com/nauth-toolkit/nauth-toolkit
- **npm Package**: https://www.npmjs.com/package/@nauth-toolkit/core
- **Live Documentation**: https://nauth-toolkit.dev (coming soon)
- **GitHub Discussions**: https://github.com/nauth-toolkit/nauth-toolkit/discussions

---

Built with [Docusaurus](https://docusaurus.io/)
