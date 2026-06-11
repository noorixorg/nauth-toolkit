# FeatureCard Component

A reusable card component for displaying features with FontAwesome icons, headings, and descriptions. Supports optional links to make the entire card clickable.

## Usage

### Basic Usage (No Link)

```tsx
import FeatureCard from '@site/src/components/FeatureCard';

<div className="feature-grid">
  <FeatureCard
    icon="fa-duotone fa-light fa-envelope-open-text"
    heading="Email & Password"
    description="Traditional signup and login with configurable password policies, reset flows, and email verification."
  />
</div>
```

### With Link

```tsx
import FeatureCard from '@site/src/components/FeatureCard';

<div className="feature-grid">
  <FeatureCard
    icon="fa-duotone fa-light fa-shield-keyhole"
    heading="Multi-Factor Authentication"
    description="TOTP authenticator apps, SMS codes, WebAuthn passkeys, and backup recovery codes."
    link="/docs/features/mfa"
  />
</div>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `icon` | `string` | Yes | FontAwesome icon class names (e.g., `"fa-duotone fa-light fa-key-skeleton"`) |
| `heading` | `string` | Yes | Card heading text |
| `description` | `string` | Yes | Card description text |
| `link` | `string` | No | Optional link URL to make the entire card clickable |

## Layout

Cards should be placed inside a container with the `feature-grid` class for responsive grid layout:

```tsx
<div className="feature-grid">
  <FeatureCard ... />
  <FeatureCard ... />
  <FeatureCard ... />
  <FeatureCard ... />
</div>
```

The grid automatically adjusts to screen size with a minimum column width of 280px.

## FontAwesome Icons

This component requires FontAwesome Pro (duotone light icons). The FontAwesome kit is loaded globally in `docusaurus.config.ts`.

### Finding Icons

Browse icons at: https://fontawesome.com/icons

Example icon classes:
- `fa-duotone fa-light fa-envelope-open-text`
- `fa-duotone fa-light fa-shield-keyhole`
- `fa-duotone fa-light fa-key-skeleton`
- `fa-duotone fa-light fa-mobile-screen`
- `fa-duotone fa-light fa-database`

## Styling

The component includes hover effects:
- Card lifts up slightly on hover
- Shadow increases
- Border color intensifies

Dark mode is fully supported with appropriate color adjustments.

