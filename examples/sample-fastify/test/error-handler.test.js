const test = require('node:test');
const assert = require('node:assert/strict');

const { errorHandler } = require('../dist/utils/error-handler.js');
const { NAuthException, AuthErrorCode } = require('@nauth-toolkit/core');

test('Fastify errorHandler returns NAUTHError response format for validation errors', () => {
  const ex = new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Validation failed', {
    validationErrors: {
      identifier: ['Identifier is required'],
    },
  });

  /** @type {any} */
  const request = { url: '/auth/login' };

  /** @type {any} */
  const reply = {
    _status: undefined,
    _payload: undefined,
    code(statusCode) {
      this._status = statusCode;
      return this;
    },
    send(payload) {
      this._payload = payload;
      return this;
    },
  };

  errorHandler(ex, request, reply);

  assert.equal(reply._status, 400);
  assert.equal(reply._payload.statusCode, 400);
  assert.equal(reply._payload.code, AuthErrorCode.VALIDATION_FAILED);
  assert.equal(reply._payload.message, 'Validation failed');
  assert.deepEqual(reply._payload.details.validationErrors, { identifier: ['Identifier is required'] });
  assert.equal(reply._payload.timestamp, ex.timestamp);
  assert.equal(reply._payload.path, '/auth/login');
});


