require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const { errorHandler } = require('../dist/utils/error-handler.js');
const { NAuthException, AuthErrorCode } = require('@nauth-toolkit/core');

test('Express errorHandler returns NAUTHError response format for validation errors', () => {
  const ex = new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Validation failed', {
    validationErrors: {
      identifier: ['Identifier is required'],
    },
  });

  /** @type {any} */
  const req = { originalUrl: '/auth/login', url: '/auth/login' };

  /** @type {any} */
  const res = {
    _status: undefined,
    _json: undefined,
    status(code) {
      this._status = code;
      return this;
    },
    json(payload) {
      this._json = payload;
      return this;
    },
  };

  errorHandler(ex, req, res, () => {});

  assert.equal(res._status, 400);
  assert.equal(res._json.statusCode, 400);
  assert.equal(res._json.code, AuthErrorCode.VALIDATION_FAILED);
  assert.equal(res._json.message, 'Validation failed');
  assert.deepEqual(res._json.details.validationErrors, { identifier: ['Identifier is required'] });
  assert.equal(res._json.timestamp, ex.timestamp);
  assert.equal(res._json.path, '/auth/login');
});


