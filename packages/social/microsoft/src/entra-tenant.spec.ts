import 'reflect-metadata';
import {
  MSA_TENANT_ID,
  authorizeEndpoint,
  expectedIssuer,
  isPersonalAccountTenant,
  isTenantAlias,
  isTenantGuid,
  isValidTenant,
  jwksEndpoint,
  tokenEndpoint,
} from './entra-tenant';

const TENANT_GUID = '9f4c2a10-1b3c-4d5e-8f70-2a1b3c4d5e6f';

/**
 * Entra tenant helper unit tests
 *
 * These pure functions decide which Microsoft endpoints are contacted and which issuer
 * a token must carry, so they are covered independently of the network paths.
 */
describe('entra-tenant', () => {
  describe('isTenantGuid', () => {
    it('accepts a directory GUID', () => {
      expect(isTenantGuid(TENANT_GUID)).toBe(true);
    });

    it('accepts a GUID regardless of case', () => {
      expect(isTenantGuid(TENANT_GUID.toUpperCase())).toBe(true);
    });

    it('rejects the aliases', () => {
      expect(isTenantGuid('common')).toBe(false);
      expect(isTenantGuid('organizations')).toBe(false);
    });

    it('rejects a malformed GUID', () => {
      expect(isTenantGuid('9f4c2a10-1b3c-4d5e-8f70')).toBe(false);
    });
  });

  describe('isTenantAlias', () => {
    it('accepts the three Microsoft aliases', () => {
      expect(isTenantAlias('common')).toBe(true);
      expect(isTenantAlias('organizations')).toBe(true);
      expect(isTenantAlias('consumers')).toBe(true);
    });

    it('rejects anything else', () => {
      expect(isTenantAlias(TENANT_GUID)).toBe(false);
      expect(isTenantAlias('everyone')).toBe(false);
    });
  });

  describe('isValidTenant', () => {
    it('accepts aliases, GUIDs and verified domains', () => {
      expect(isValidTenant('common')).toBe(true);
      expect(isValidTenant(TENANT_GUID)).toBe(true);
      expect(isValidTenant('contoso.onmicrosoft.com')).toBe(true);
    });

    it('rejects a bare word that is not an alias', () => {
      expect(isValidTenant('mytenant')).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(isValidTenant('')).toBe(false);
    });
  });

  describe('endpoint construction', () => {
    it('builds tenant-scoped authorize and token endpoints', () => {
      expect(authorizeEndpoint(TENANT_GUID)).toBe(
        `https://login.microsoftonline.com/${TENANT_GUID}/oauth2/v2.0/authorize`,
      );
      expect(tokenEndpoint(TENANT_GUID)).toBe(`https://login.microsoftonline.com/${TENANT_GUID}/oauth2/v2.0/token`);
    });

    it('builds alias-scoped endpoints', () => {
      expect(authorizeEndpoint('common')).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    });

    it('uses the pinned directory key set when the tenant is a GUID', () => {
      expect(jwksEndpoint(TENANT_GUID)).toBe(
        `https://login.microsoftonline.com/${TENANT_GUID}/discovery/v2.0/keys`,
      );
    });

    it('falls back to the common key set for the aliases', () => {
      expect(jwksEndpoint('organizations')).toBe('https://login.microsoftonline.com/common/discovery/v2.0/keys');
      expect(jwksEndpoint('consumers')).toBe('https://login.microsoftonline.com/common/discovery/v2.0/keys');
    });
  });

  describe('expectedIssuer', () => {
    it('binds the issuer to a directory id', () => {
      expect(expectedIssuer(TENANT_GUID)).toBe(`https://login.microsoftonline.com/${TENANT_GUID}/v2.0`);
    });
  });

  describe('isPersonalAccountTenant', () => {
    it('recognises the personal-account directory', () => {
      expect(isPersonalAccountTenant(MSA_TENANT_ID)).toBe(true);
      expect(isPersonalAccountTenant(MSA_TENANT_ID.toUpperCase())).toBe(true);
    });

    it('treats a work directory as non-personal', () => {
      expect(isPersonalAccountTenant(TENANT_GUID)).toBe(false);
    });
  });
});
