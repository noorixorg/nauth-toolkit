import React from 'react';
import Link from '@docusaurus/Link';
import './FeatureCard.css';

/**
 * Reusable feature card component with icon, heading, and description
 *
 * @param icon - FontAwesome icon class names (e.g., "fa-duotone fa-light fa-key-skeleton")
 * @param heading - Card heading text
 * @param description - Card description text
 * @param link - Optional link URL to make the entire card clickable
 *
 * @example
 * ```tsx
 * <FeatureCard
 *   icon="fa-duotone fa-light fa-envelope-open-text"
 *   heading="Email & Password"
 *   description="Traditional signup and login with configurable password policies."
 * />
 * ```
 *
 * @example With link
 * ```tsx
 * <FeatureCard
 *   icon="fa-duotone fa-light fa-shield-keyhole"
 *   heading="Multi-Factor Authentication"
 *   description="TOTP authenticator apps, SMS codes, and more."
 *   link="/docs/features/mfa"
 * />
 * ```
 */
interface FeatureCardProps {
  icon: string;
  heading: string;
  description: string;
  link?: string;
}

export default function FeatureCard({
  icon,
  heading,
  description,
  link,
}: FeatureCardProps): React.JSX.Element {
  const content = (
    <>
      <div className="feature-card-header">
        <i className={icon}></i>
        <strong>{heading}</strong>
      </div>
      <p className="feature-card-description">{description}</p>
    </>
  );

  if (link) {
    return (
      <Link to={link} className="feature-card feature-card-link">
        {content}
      </Link>
    );
  }

  return <div className="feature-card">{content}</div>;
}

