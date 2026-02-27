---
title: Interfaces
description: TypeScript interfaces for configuration, providers, and platform adapters
keywords: [interfaces, types, config, providers, adapter, api]
image: /img/api-social-card.png
sidebar_position: 1
sidebar_label: Overview
---
# Interfaces

**Package:** `@nauth-toolkit/core`
**Type:** TypeScript Interfaces

## Configuration

- [NAuthConfig](./nauth-config) - Top-level configuration interface
- [RecaptchaConfig](./recaptcha-config) - reCAPTCHA integration settings
- [SMSTemplateEngine](./sms-template-engine) - Template engine contract for SMS templates
- [Configuration Guide](/docs/concepts/configuration) - Complete `NAuthConfig` reference (single source of truth)

## Providers

- [EmailProvider](./email-provider) - Contract for sending emails
- [SMSProvider](./sms-provider) - Contract for sending SMS messages (templates supported)
- [StorageAdapter](./storage-adapter) - Shared state adapter (rate limits, locks, token reuse)

## Entities (interfaces)

- [IUser](./user) - User record contract
- [ISession](./session) - Session record contract

## Response types

- [AuthResponseUser](./auth-response-user) - Sanitized user object returned in auth responses

## Adaptive MFA

- [AdaptiveMFAUser](./adaptive-mfa-user) - User context for risk assessment
- [AdaptiveMFARiskEventPayload](./adaptive-mfa-risk-event-payload) - Risk event hook payload

## Platform adapter contracts

- [NAuthAdapter](./nauth-adapter) - Framework adapter contract
- [NAuthRequest](./nauth-request) - Framework-agnostic request shape
- [NAuthResponse](./nauth-response) - Framework-agnostic response contract

## Related

- [Configuration](/docs/concepts/configuration)
- [How It Works — Framework Support](/docs/concepts/how-it-works#framework-support)

