import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { PRINTER_TEST_HTML, signQzMessage, validQzRequest } from './hardware/qzSigning';
import { createServerApp } from './app';

const timestamp = Date.now();
const request = (call: string, params?: unknown) => ({ call, params, timestamp });
const print = (data: unknown, printer: unknown = { name: 'EPSON' }) => request('print', { printer, options: {}, data: [data] });

test('signing supports the requests used by counter discovery, receipts and drawers', () => {
  for (const message of [
    request('printers.find', {}), request('serial.findPorts'),
    request('serial.openPort', { port: 'COM4', options: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'NONE', flowControl: 'NONE' } }),
    request('serial.sendData', { port: 'COM4', data: { type: 'HEX', data: '07' } }),
    request('serial.closePort', { port: 'COM4' }),
    print({ type: 'pixel', format: 'pdf', flavor: 'base64', data: Buffer.from('%PDF-1.7\n').toString('base64') }),
    print({ type: 'pixel', format: 'html', flavor: 'plain', data: PRINTER_TEST_HTML }),
    print({ type: 'raw', format: 'command', flavor: 'hex', data: '1B700019FA' }),
  ]) assert.equal(validQzRequest(message, timestamp), true, JSON.stringify(message));
});

test('signer rejects unrelated device access, files, URLs, arbitrary HTML and stale requests', () => {
  for (const message of [
    request('file.read', { path: 'secret' }), request('socket.open', { host: 'example.com' }),
    print({ type: 'pixel', format: 'pdf', flavor: 'file', data: 'file:///private.pdf' }),
    print({ type: 'pixel', format: 'html', flavor: 'plain', data: '<img src="file:///private">' }),
    print({ type: 'raw', format: 'command', flavor: 'hex', data: '07' }, { file: 'output.txt' }),
    request('serial.sendData', { port: 'COM4', data: { type: 'FILE', data: 'private.txt' } }),
    { ...request('printers.find', {}), timestamp: timestamp - 301_000 },
  ]) assert.equal(validQzRequest(message, timestamp), false);
});

test('signature verifies using QZ’s digest and rejects changed content', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const message = JSON.stringify(request('printers.find', {}));
  const signature = Buffer.from(signQzMessage(message, privateKey), 'base64');
  const digest = createHash('sha256').update(message).digest('hex');
  assert.equal(verify('RSA-SHA512', Buffer.from(digest), publicKey, signature), true);
  assert.equal(verify('RSA-SHA512', Buffer.from(digest + 'changed'), publicKey, signature), false);
});

test('signing endpoints require authentication and reject cross-origin requests', async () => {
  const app = createServerApp();
  assert.equal((await app.request('http://pharm.test/api/hardware/qz-certificate')).status, 401);
  const call = (origin: string) => app.request('http://pharm.test/api/hardware/qz-sign', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(request('printers.find', {})),
  });
  assert.equal((await call('http://other.test')).status, 403);
  assert.equal((await call('http://pharm.test')).status, 401);
});
