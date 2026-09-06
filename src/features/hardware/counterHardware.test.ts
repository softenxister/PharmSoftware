import assert from 'node:assert/strict';
import test from 'node:test';
import { commandHex, DEFAULT_HARDWARE, drawerSetupError, loadHardware, normalizeHardware, saveHardware, sendDrawerCommand, type QzBridge } from './counterHardware';

function bridge(failSend = false) {
  const calls: unknown[] = [];
  const qz: QzBridge = {
    api: { setSha256Type: () => {} },
    security: { setCertificatePromise: () => {}, setSignatureAlgorithm: () => {}, setSignaturePromise: () => {} },
    websocket: { isActive: () => true, connect: async () => {} },
    printers: { find: async () => ['EPSON'] },
    configs: { create: (printer, options) => ({ printer, options }) },
    print: async (config, data) => { calls.push({ config, data }); },
    serial: {
      findPorts: async () => ['COM4'],
      openPort: async (port, options) => { calls.push(['open', port, options]); },
      sendData: async (port, data) => { calls.push(['send', port, data]); if (failSend) throw new Error('disconnected'); },
      closePort: async port => { calls.push(['close', port]); },
    },
  };
  return { qz, calls };
}

test('unknown/corrupt preferences cannot enable a drawer', () => {
  assert.equal(normalizeHardware(null).drawer, 'none');
  assert.equal(normalizeHardware({ drawer: 'usb', baudRate: -1, printer: 123 }).drawer, 'none');
  assert.equal(normalizeHardware({ baudRate: -1 }).baudRate, 9600);
  assert.equal(normalizeHardware({ printer: 123 }).printer, '');
});

test('drawer commands preserve binary bytes and reject malformed/oversized input', () => {
  assert.equal(commandHex(' 1b 70 00 19 fa '), '1B700019FA');
  for (const value of ['', '1B7', '0x1b', 'GG', '1B7000', '00 '.repeat(257)]) {
    assert.throws(() => commandHex(value));
  }
});

test('printer drawers target their own queue using raw hexadecimal data', async () => {
  const { qz, calls } = bridge();
  await sendDrawerCommand(qz, { ...DEFAULT_HARDWARE, drawer: 'printer', printer: 'OTHER', drawerPrinter: 'EPSON' });
  assert.deepEqual(calls, [{ config: { printer: 'EPSON', options: { jobName: 'Pharm cash drawer' } },
    data: [{ type: 'raw', format: 'command', flavor: 'hex', data: '1B700019FA' }] }]);
});

test('missing devices and disabled drawers never emit commands', async () => {
  const { qz, calls } = bridge();
  await assert.rejects(sendDrawerCommand(qz, DEFAULT_HARDWARE), /No cash drawer/);
  await assert.rejects(sendDrawerCommand(qz, { ...DEFAULT_HARDWARE, drawer: 'printer', drawerPrinter: 'missing' }), /unavailable/);
  await assert.rejects(sendDrawerCommand(qz, { ...DEFAULT_HARDWARE, drawer: 'serial', port: 'COM8' }), /unavailable/);
  assert.deepEqual(calls, []);
});

test('serial drawers release the port even when sending fails, without retrying a pulse', async () => {
  const { qz, calls } = bridge(true);
  await assert.rejects(sendDrawerCommand(qz, { ...DEFAULT_HARDWARE, drawer: 'serial', port: 'COM4', command: '07' }), /disconnected/);
  assert.deepEqual(calls, [
    ['open', 'COM4', { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'NONE', flowControl: 'NONE' }],
    ['send', 'COM4', { type: 'HEX', data: '07' }], ['close', 'COM4'],
  ]);
});

test('counter setup persists without discovery, including an unfinished serial drawer', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const stored = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  } });
  try {
    const settings = { ...DEFAULT_HARDWARE, printer: 'EPSON', drawer: 'serial' as const, port: 'COM4', command: '' };
    saveHardware(settings);
    assert.deepEqual(loadHardware(), settings);
    assert.match(drawerSetupError(loadHardware())!, /manufacturer/);
    saveHardware({ ...settings, command: '07' });
    assert.equal(drawerSetupError(loadHardware()), null);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('saved incomplete or malformed drawer setups never perform hardware IO', async () => {
  const { qz, calls } = bridge();
  for (const setup of [
    { drawer: 'serial' as const, port: 'COM4', command: '' },
    { drawer: 'serial' as const, port: '', command: '07' },
    { drawer: 'printer' as const, drawerPrinter: '', command: '07' },
    { drawer: 'serial' as const, port: 'COM4', command: 'invalid' },
  ]) {
    await assert.rejects(sendDrawerCommand(qz, { ...DEFAULT_HARDWARE, ...setup }));
  }
  assert.deepEqual(calls, []);
});
