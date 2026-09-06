import assert from 'node:assert/strict';
import test from 'node:test';
import { configureQzSigning, type QzSigningBridge } from './qzSigning';

test('QZ signing forwards the full request for server validation and fails closed', async () => {
  let hasher: (message: string) => Promise<string>;
  let certificate: Parameters<QzSigningBridge['security']['setCertificatePromise']>[0];
  let factory: Parameters<QzSigningBridge['security']['setSignaturePromise']>[0];
  const qz: QzSigningBridge = {
    api: { setSha256Type: value => { hasher = value; } },
    security: {
      setCertificatePromise: (value, rejectOnFailure) => { certificate = value; assert.equal(rejectOnFailure, true); },
      setSignatureAlgorithm: value => { assert.equal(value, 'SHA512'); },
      setSignaturePromise: value => { factory = value; },
    },
  };
  configureQzSigning(qz);
  const original = globalThis.fetch;
  const message = '{"call":"printers.find","params":{},"timestamp":123}';
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options?.body, message);
      return new Response('signature');
    };
    assert.equal(await new Promise(factory(await hasher(message))), 'signature');
    globalThis.fetch = async () => Response.json({ error: 'Sign in first' }, { status: 401 });
    await assert.rejects(new Promise(certificate), /Sign in first/);
    await assert.rejects(new Promise(factory(message)), /Sign in first/);
  } finally { globalThis.fetch = original; }
});
