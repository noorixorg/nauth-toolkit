#!/usr/bin/env node

/**
 * Generate skeleton API documentation pages with consistent structure
 * Based on the API documentation plan
 */

const fs = require('fs');
const path = require('path');

// API inventory from the plan
const inventory = {
  core: {
    services: [
      { name: 'AuthService', desc: 'Main auth orchestration' },
      { name: 'PasswordService', desc: 'Password hashing/verification' },
      { name: 'JwtService', desc: 'JWT token generation/validation' },
      { name: 'SessionService', desc: 'Session lifecycle management' },
      { name: 'EmailVerificationService', desc: 'Email verification flows' },
      { name: 'PhoneVerificationService', desc: 'Phone verification flows' },
      { name: 'SocialAuthService', desc: 'Social provider orchestration' },
      { name: 'SocialAccountService', desc: 'Social account linking' },
      { name: 'MFAService', desc: 'MFA provider registry and orchestration' },
      { name: 'ChallengeService', desc: 'Challenge state management' },
      { name: 'RiskDetectionService', desc: 'Risk factor detection' },
      { name: 'RiskScoringService', desc: 'Risk score calculation' },
      { name: 'AdaptiveMFADecisionService', desc: 'Adaptive MFA decisions' },
      { name: 'GeoLocationService', desc: 'IP geolocation' },
      { name: 'TrustedDeviceService', desc: 'Device tracking' },
      { name: 'ClientInfoService', desc: 'IP/user-agent extraction' },
      { name: 'AuthAuditService', desc: 'Audit trail logging' },
    ],
    dtos: [
      { name: 'SignupDTO', desc: 'User registration' },
      { name: 'LoginDTO', desc: 'User login' },
      { name: 'RefreshTokenDTO', desc: 'Token refresh' },
      { name: 'ChangePasswordRequestDTO', desc: 'Password change request' },
      { name: 'ChangePasswordResponseDTO', desc: 'Password change response' },
      { name: 'ResetPasswordDTO', desc: 'Password reset' },
      { name: 'VerifyEmailDTO', desc: 'Email verification' },
      { name: 'VerifyPhoneDTO', desc: 'Phone verification' },
      { name: 'UpdateUserAttributesRequestDTO', desc: 'User profile updates' },
      { name: 'ResendCodeDTO', desc: 'Resend verification codes' },
      { name: 'ResendCodeResponseDTO', desc: 'Resend code response' },
      { name: 'RespondChallengeDTO', desc: 'Respond to challenge' },
      { name: 'AuthResponseDTO', desc: 'Unified auth response' },
      { name: 'ChallengeResponseDTO', desc: 'Challenge state response' },
      { name: 'UserResponseDTO', desc: 'User data response' },
      { name: 'AuthChallengeDTO', desc: 'Challenge information' },
      { name: 'GetUserByEmailDTO', desc: 'Get user by email request' },
      { name: 'GetUserByIdDTO', desc: 'Get user by ID request' },
      { name: 'LogoutDTO', desc: 'Logout request' },
      { name: 'LogoutResponseDTO', desc: 'Logout response' },
      { name: 'LogoutAllDTO', desc: 'Logout all sessions request' },
      { name: 'LogoutAllResponseDTO', desc: 'Logout all sessions response' },
      { name: 'SetMustChangePasswordDTO', desc: 'Set must change password request' },
      { name: 'SetMustChangePasswordResponseDTO', desc: 'Set must change password response' },
      { name: 'TrustDeviceResponseDTO', desc: 'Trust device response' },
      { name: 'ChallengeResponseData', desc: 'Challenge response data' },
    ],
  },
  nestjs: {
    guards: [
      { name: 'AuthGuard', desc: 'JWT route protection' },
      { name: 'CsrfGuard', desc: 'CSRF validation' },
    ],
    decorators: [
      { name: '@CurrentUser()', desc: 'Extract authenticated user' },
      { name: '@Public()', desc: 'Bypass AuthGuard' },
      { name: '@ClientInfo()', desc: 'Extract client metadata' },
      { name: '@TokenDelivery()', desc: 'Override delivery mode' },
    ],
    interceptors: [
      { name: 'ClientInfoInterceptor', desc: 'Auto-extract client info' },
      { name: 'CookieTokenInterceptor', desc: 'Cookie-based delivery' },
    ],
  },
  express: {
    middleware: [
      { name: 'authMiddleware', desc: 'JWT authentication middleware' },
      { name: 'csrfMiddleware', desc: 'CSRF protection middleware' },
      { name: 'clientInfoMiddleware', desc: 'Client info extraction' },
      { name: 'tokenDeliveryMiddleware', desc: 'Cookie delivery handler' },
    ],
    helpers: [
      { name: 'requireAuth()', desc: 'Sync auth requirement' },
      { name: 'optionalAuth()', desc: 'Optional auth handler' },
      { name: 'publicRoute()', desc: 'Mark public routes' },
      { name: 'tokenDelivery()', desc: 'Override delivery mode' },
    ],
  },
};

function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_@()]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function createServiceSkeleton(service, position) {
  return `---
title: ${service.name}
description: ${service.desc}
sidebar_position: ${position}
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ${service.name}

**Package:** \`@nauth-toolkit/core\`
**Type:** Service

${service.desc}

:::tip Import from Your Platform Package
\`\`\`typescript
// NestJS
import { ${service.name} } from '@nauth-toolkit/nestjs';

// Express
import { ${service.name} } from '@nauth-toolkit/express';
\`\`\`
:::

## Overview

TODO: Add overview

## Methods

TODO: Add methods

## Related APIs

TODO: Add related APIs
`;
}

function createDTOSkeleton(dto, position) {
  return `---
title: ${dto.name}
description: ${dto.desc}
sidebar_position: ${position}
---

# ${dto.name}

**Package:** \`@nauth-toolkit/core\`
**Type:** DTO

${dto.desc}

:::tip Import from Your Platform Package
\`\`\`typescript
// NestJS
import { ${dto.name} } from '@nauth-toolkit/nestjs';

// Express
import { ${dto.name} } from '@nauth-toolkit/express';
\`\`\`
:::

## Overview

TODO: Add overview

## Properties

TODO: Add properties table

## Usage Examples

TODO: Add examples

## Related APIs

TODO: Add related APIs
`;
}

function createGuardSkeleton(guard, position) {
  return `---
title: ${guard.name}
description: ${guard.desc}
sidebar_position: ${position}
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ${guard.name}

**Package:** \`@nauth-toolkit/nestjs\`
**Type:** Guard

${guard.desc}

:::tip Import from NestJS Package
\`\`\`typescript
import { ${guard.name} } from '@nauth-toolkit/nestjs';
\`\`\`
:::

## Overview

TODO: Add overview

## Usage

TODO: Add usage examples

## Related APIs

TODO: Add related APIs
`;
}

function createDecoratorSkeleton(decorator, position) {
  const cleanName = decorator.name.replace(/[@()]/g, '');
  return `---
title: "${decorator.name}"
description: ${decorator.desc}
sidebar_position: ${position}
---

# ${decorator.name}

**Package:** \`@nauth-toolkit/nestjs\`
**Type:** ${decorator.name.startsWith('@') ? 'Decorator' : 'Function'}

${decorator.desc}

:::tip Import from NestJS Package
\`\`\`typescript
import { ${cleanName} } from '@nauth-toolkit/nestjs';
\`\`\`
:::

## Overview

TODO: Add overview

## Usage

TODO: Add usage examples

## Related APIs

TODO: Add related APIs
`;
}

function createMiddlewareSkeleton(middleware, position) {
  return `---
title: ${middleware.name}
description: ${middleware.desc}
sidebar_position: ${position}
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ${middleware.name}

**Package:** \`@nauth-toolkit/express\`
**Type:** Middleware

${middleware.desc}

:::tip Import from Express Package
\`\`\`typescript
import { ${middleware.name} } from '@nauth-toolkit/express';
\`\`\`
:::

## Overview

TODO: Add overview

## Usage

TODO: Add usage examples

## Related APIs

TODO: Add related APIs
`;
}

// Generate skeletons
const docsDir = path.join(__dirname, '../docs/api');

console.log('🔧 Generating skeleton documentation pages...\n');

// Core Services
console.log('📦 Core Services...');
const servicesDir = path.join(docsDir, 'core/services');
fs.mkdirSync(servicesDir, { recursive: true });

inventory.core.services.forEach((service, idx) => {
  const filename = toKebabCase(service.name) + '.md';
  const filepath = path.join(servicesDir, filename);

  // Skip if already exists and has content
  if (fs.existsSync(filepath)) {
    const existing = fs.readFileSync(filepath, 'utf-8');
    if (existing.includes('## Methods') && !existing.includes('TODO: Add methods')) {
      console.log(`  ⏭️  Skipping ${filename} (already has content)`);
      return;
    }
  }

  fs.writeFileSync(filepath, createServiceSkeleton(service, idx + 1));
  console.log(`  ${filename}`);
});

// Core DTOs
console.log('\n📦 Core DTOs...');
const dtosDir = path.join(docsDir, 'core/dto');
fs.mkdirSync(dtosDir, { recursive: true });

inventory.core.dtos.forEach((dto, idx) => {
  const filename = toKebabCase(dto.name) + '.md';
  const filepath = path.join(dtosDir, filename);

  if (fs.existsSync(filepath)) {
    const existing = fs.readFileSync(filepath, 'utf-8');
    if (existing.includes('## Properties') && !existing.includes('TODO: Add properties')) {
      console.log(`  ⏭️  Skipping ${filename} (already has content)`);
      return;
    }
  }

  fs.writeFileSync(filepath, createDTOSkeleton(dto, idx + 1));
  console.log(`  ${filename}`);
});

// NestJS Guards
console.log('\n📦 NestJS Guards...');
const guardsDir = path.join(docsDir, 'nestjs/guards');
fs.mkdirSync(guardsDir, { recursive: true });

inventory.nestjs.guards.forEach((guard, idx) => {
  const filename = toKebabCase(guard.name) + '.md';
  const filepath = path.join(guardsDir, filename);

  if (fs.existsSync(filepath) && !fs.readFileSync(filepath, 'utf-8').includes('TODO:')) {
    console.log(`  ⏭️  Skipping ${filename} (already has content)`);
    return;
  }

  fs.writeFileSync(filepath, createGuardSkeleton(guard, idx + 1));
  console.log(`  ${filename}`);
});

// NestJS Decorators
console.log('\n📦 NestJS Decorators...');
const decoratorsDir = path.join(docsDir, 'nestjs/decorators');
fs.mkdirSync(decoratorsDir, { recursive: true });

inventory.nestjs.decorators.forEach((decorator, idx) => {
  const filename = toKebabCase(decorator.name) + '.md';
  const filepath = path.join(decoratorsDir, filename);

  if (fs.existsSync(filepath) && !fs.readFileSync(filepath, 'utf-8').includes('TODO:')) {
    console.log(`  ⏭️  Skipping ${filename} (already has content)`);
    return;
  }

  fs.writeFileSync(filepath, createDecoratorSkeleton(decorator, idx + 1));
  console.log(`  ${filename}`);
});

// Express Middleware
console.log('\n📦 Express Middleware...');
const middlewareDir = path.join(docsDir, 'express/middleware');
fs.mkdirSync(middlewareDir, { recursive: true });

inventory.express.middleware.forEach((middleware, idx) => {
  const filename = toKebabCase(middleware.name) + '.md';
  const filepath = path.join(middlewareDir, filename);

  if (fs.existsSync(filepath) && !fs.readFileSync(filepath, 'utf-8').includes('TODO:')) {
    console.log(`  ⏭️  Skipping ${filename} (already has content)`);
    return;
  }

  fs.writeFileSync(filepath, createMiddlewareSkeleton(middleware, idx + 1));
  console.log(`  ${filename}`);
});

// Express Helpers
console.log('\n📦 Express Helpers...');
const helpersDir = path.join(docsDir, 'express/helpers');
fs.mkdirSync(helpersDir, { recursive: true });

inventory.express.helpers.forEach((helper, idx) => {
  const filename = toKebabCase(helper.name) + '.md';
  const filepath = path.join(helpersDir, filename);

  if (fs.existsSync(filepath) && !fs.readFileSync(filepath, 'utf-8').includes('TODO:')) {
    console.log(`  ⏭️  Skipping ${filename} (already has content)`);
    return;
  }

  fs.writeFileSync(filepath, createMiddlewareSkeleton(helper, idx + 1));
  console.log(`  ${filename}`);
});

  console.log('\nSkeleton generation complete!');
console.log('\n📝 Next steps:');
console.log('  1. Review generated skeletons');
console.log('  2. Fill in method signatures and descriptions');
console.log('  3. Add cross-reference links');
console.log('  4. Add usage examples');


