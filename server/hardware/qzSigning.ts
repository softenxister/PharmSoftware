import { createHash, createPrivateKey, sign, X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const name = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 256;
const hex = (value: unknown) => typeof value === 'string' && /^(?:[\da-f]{2}){1,256}$/i.test(value);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
export const PRINTER_TEST_HTML = '<html><body><h3>Pharm printer test</h3><p>0123456789</p><p>Printer driver connection test</p></body></html>';

export function validQzRequest(value: unknown, now = Date.now()): boolean {
  if (!record(value) || !keys(value, ['call', 'params', 'timestamp']) || !Number.isSafeInteger(value.timestamp) || Math.abs(now - value.timestamp) > 300_000) return false;
  const p = value.params ?? {};
  if (!record(p)) return false;
  if (value.call === 'printers.find') return keys(p, ['query']) && (p.query == null || name(p.query));
  if (value.call === 'serial.findPorts') return keys(p, []);
  if (value.call === 'serial.closePort') return keys(p, ['port']) && name(p.port);
  if (value.call === 'serial.openPort') {
    return keys(p, ['port', 'options']) && name(p.port) && record(p.options)
      && keys(p.options, ['baudRate', 'dataBits', 'stopBits', 'parity', 'flowControl'])
      && [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].includes(p.options.baudRate)
      && p.options.dataBits === 8 && p.options.stopBits === 1 && p.options.parity === 'NONE' && p.options.flowControl === 'NONE';
  }
  if (value.call === 'serial.sendData') {
    return keys(p, ['port', 'data']) && name(p.port) && record(p.data)
      && keys(p.data, ['type', 'data']) && p.data.type === 'HEX' && hex(p.data.data);
  }
  if (value.call !== 'print' || !keys(p, ['printer', 'options', 'data'])) return false;
  // Accept installed print queues only, never QZ file or socket destinations.
  if (!record(p.printer) || !keys(p.printer, ['name']) || !name(p.printer.name)) return false;
  if (!record(p.options) || !Array.isArray(p.data) || p.data.length !== 1) return false;
  const d = p.data[0];
  if (!record(d) || !keys(d, ['type', 'format', 'flavor', 'data'])) return false;
  if (d.type === 'raw') return d.format === 'command' && d.flavor === 'hex' && hex(d.data);
  if (d.type !== 'pixel') return false;
  if (d.format === 'html') return d.flavor === 'plain' && d.data === PRINTER_TEST_HTML;
  return d.format === 'pdf' && d.flavor === 'base64' && typeof d.data === 'string'
    && /^[A-Za-z0-9+/]+={0,2}$/.test(d.data) && Buffer.from(d.data, 'base64').subarray(0, 5).toString() === '%PDF-';
}

export async function readQzCredentials() {
  const directory = resolve(process.env.PHARM_QZ_SIGNING_DIR || '.local/qz-signing');
  const [certificate, privatePem] = await Promise.all([
    readFile(resolve(directory, 'certificate.pem'), 'utf8'),
    readFile(resolve(directory, 'private-key.pem'), 'utf8'),
  ]);
  const cert = new X509Certificate(certificate);
  const key = createPrivateKey(privatePem);
  if (!cert.checkPrivateKey(key) || Date.now() < Date.parse(cert.validFrom) || Date.now() >= Date.parse(cert.validTo)) throw new Error('Invalid signing credentials');
  return { certificate, key };
}

export function signQzMessage(message: string, key: ReturnType<typeof createPrivateKey>) {
  // Match QZ's SHA-256 hex digest followed by RSA/SHA-512 signing.
  const digest = createHash('sha256').update(message).digest('hex');
  return sign('RSA-SHA512', Buffer.from(digest), key).toString('base64');
}
