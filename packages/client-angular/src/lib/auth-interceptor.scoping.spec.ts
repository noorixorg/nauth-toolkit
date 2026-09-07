/**
 * Credential-scoping tests for the shared Angular interceptor.
 *
 * The interceptor decides, per outbound request, whether to attach the session cookie
 * (`withCredentials` + CSRF header) or the bearer token. That decision must be an
 * origin comparison: a substring test hands those credentials to any host whose URL
 * merely contains the API base string.
 */
import 'reflect-metadata';
import { isEndpointPath, isSameApiTarget } from './auth-interceptor.shared';

describe('isSameApiTarget', () => {
  const baseUrl = 'https://api.example.com';

  it('accepts the API origin itself', () => {
    expect(isSameApiTarget('https://api.example.com/auth/me', baseUrl)).toBe(true);
    expect(isSameApiTarget('https://api.example.com/', baseUrl)).toBe(true);
  });

  it('rejects a look-alike host that merely starts with the base URL', () => {
    // The reported leak: `.includes(baseUrl)` is true here, so cookies and the bearer
    // token were attached to a host the attacker owns.
    expect(isSameApiTarget('https://api.example.com.evil.com/collect', baseUrl)).toBe(false);
  });

  it('rejects a foreign host carrying the base URL in its query string', () => {
    expect(isSameApiTarget('https://evil.com/collect?u=https://api.example.com', baseUrl)).toBe(false);
  });

  it('rejects a matching host on another scheme or port', () => {
    expect(isSameApiTarget('http://api.example.com/auth/me', baseUrl)).toBe(false);
    expect(isSameApiTarget('https://api.example.com:8443/auth/me', baseUrl)).toBe(false);
  });

  it('honours a path prefix on the base URL, on a segment boundary', () => {
    const prefixed = 'https://api.example.com/api';
    expect(isSameApiTarget('https://api.example.com/api/auth/login', prefixed)).toBe(true);
    expect(isSameApiTarget('https://api.example.com/api', prefixed)).toBe(true);
    expect(isSameApiTarget('https://api.example.com/apix/auth', prefixed)).toBe(false);
    expect(isSameApiTarget('https://api.example.com/other', prefixed)).toBe(false);
  });

  it('resolves a relative request URL against the document origin', () => {
    // jsdom serves the tests from http://localhost/
    expect(isSameApiTarget('/auth/me', 'http://localhost')).toBe(true);
    expect(isSameApiTarget('/auth/me', baseUrl)).toBe(false);
  });

  it('fails closed on an unparseable URL', () => {
    expect(isSameApiTarget('http://[bad', baseUrl)).toBe(false);
    expect(isSameApiTarget('https://api.example.com/auth/me', 'http://[bad')).toBe(false);
  });
});

describe('isEndpointPath', () => {
  it('matches the endpoint on a whole trailing segment', () => {
    expect(isEndpointPath('https://api.example.com/auth/login', '/login')).toBe(true);
    expect(isEndpointPath('https://api.example.com/auth/login', 'login')).toBe(true);
    expect(isEndpointPath('https://api.example.com/auth/relogin', '/login')).toBe(false);
  });

  it('ignores the query string, which a substring test would match', () => {
    expect(isEndpointPath('https://api.example.com/orders?next=/login', '/login')).toBe(false);
  });

  it('fails closed on an unparseable URL', () => {
    expect(isEndpointPath('http://[bad', '/login')).toBe(false);
  });
});
