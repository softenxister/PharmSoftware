import { configureQzSigning, type QzSigningBridge } from './qzSigning';

/** Hardware belongs to the browser counter, never the application server. */
export type CounterHardware = {
  printer: string;
  drawer: 'none' | 'printer' | 'serial';
  drawerPrinter: string;
  port: string;
  baudRate: number;
  command: string;
};

const STORAGE_KEY = 'pharm:counter-hardware:v1';
export const DEFAULT_HARDWARE: CounterHardware = {
  printer: '', drawer: 'none', drawerPrinter: '', port: '', baudRate: 9600,
  command: '1B 70 00 19 FA',
};

export function normalizeHardware(value: unknown): CounterHardware {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const name = (key: string) => typeof v[key] === 'string' ? (v[key] as string).slice(0, 256) : '';
  return {
    printer: name('printer'), drawerPrinter: name('drawerPrinter'), port: name('port'),
    drawer: v.drawer === 'printer' || v.drawer === 'serial' ? v.drawer : 'none',
    baudRate: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].includes(Number(v.baudRate)) ? Number(v.baudRate) : 9600,
    command: typeof v.command === 'string' ? v.command.slice(0, 768) : DEFAULT_HARDWARE.command,
  };
}

export function loadHardware(): CounterHardware {
  try { return normalizeHardware(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
  catch { return { ...DEFAULT_HARDWARE }; }
}

export function commandHex(command: string): string {
  const value = command.trim();
  if (!/^[\da-f]{2}(?:\s+[\da-f]{2}){0,255}$/i.test(value)) {
    throw new Error('Enter 1–256 hexadecimal bytes separated by spaces (for example 1B 70 00 19 FA).');
  }
  return value.replace(/\s+/g, '').toUpperCase();
}

export function saveHardware(value: CounterHardware) {
  // Keep partially configured devices across visits. Validate before hardware IO,
  // not persistence: an unfinished drawer must not prevent saving the printer.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeHardware(value)));
}

export function drawerSetupError(settings: CounterHardware): string | null {
  if (settings.drawer === 'none') return null;
  if (settings.drawer === 'printer' && !settings.drawerPrinter.trim()) return 'Select the printer that receives the drawer command.';
  if (settings.drawer === 'serial' && !settings.port.trim()) return 'Select the cash drawer serial port.';
  if (!settings.command.trim()) return 'Enter the drawer manufacturer’s open command.';
  try { commandHex(settings.command); } catch (error) { return (error as Error).message; }
  return null;
}

export interface QzBridge extends QzSigningBridge {
  websocket: { isActive(): boolean; connect(options?: object): Promise<void> };
  printers: { find(): Promise<string[]> };
  configs: { create(printer: string, options?: object): unknown };
  print(config: unknown, data: unknown[]): Promise<void>;
  serial: {
    findPorts(): Promise<string[]>;
    openPort(port: string, options: object): Promise<void>;
    sendData(port: string, data: object): Promise<void>;
    closePort(port: string): Promise<void>;
  };
}

declare global { interface Window { qz?: QzBridge } }
let loading: Promise<QzBridge> | undefined;
let connecting: Promise<void> | undefined;

async function loadBridge(): Promise<QzBridge> {
  if (window.qz) return window.qz;
  if (!loading) {
    loading = new Promise<QzBridge>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${import.meta.env.BASE_URL}vendor/qz-tray/qz-tray.js`;
      script.onload = () => window.qz ? resolve(window.qz) : reject(new Error('Hardware library did not load.'));
      script.onerror = () => { script.remove(); reject(new Error('Unable to load the hardware library. Reload and try again.')); };
      document.head.appendChild(script);
    }).catch(error => { loading = undefined; throw error; });
  }
  return loading;
}

export async function connectHardware(): Promise<QzBridge> {
  const qz = await loadBridge();
  configureQzSigning(qz);
  if (!qz.websocket.isActive()) {
    connecting ??= qz.websocket.connect({ host: 'localhost', retries: 0 }).finally(() => { connecting = undefined; });
    try { await connecting; }
    catch { throw new Error('Cannot connect to QZ Tray on this PC. Install/start QZ Tray, then allow this site in its connection prompt.'); }
  }
  return qz;
}

export async function discoverHardware() {
  const qz = await connectHardware();
  const printers = await qz.printers.find();
  // Serial permission/driver failures must not hide otherwise usable printers.
  const serial = await qz.serial.findPorts().then(ports => ({ ports, portError: '' }),
    error => ({ ports: [] as string[], portError: String(error) }));
  return { printers: [...new Set(printers)].sort(), ...serial };
}

async function requirePrinter(qz: QzBridge, name: string) {
  if (!name || !(await qz.printers.find()).includes(name)) {
    throw new Error('Selected printer is unavailable. Reconnect it and select its installed driver in Settings → Printers & Cash Drawer.');
  }
}

export async function printCounterPdf(base64: string, printer = loadHardware().printer) {
  const qz = await connectHardware();
  await requirePrinter(qz, printer);
  await qz.print(qz.configs.create(printer, { jobName: 'Pharm receipt', scaleContent: false }),
    [{ type: 'pixel', format: 'pdf', flavor: 'base64', data: base64 }]);
}

export async function testCounterPrinter(printer: string) {
  const qz = await connectHardware();
  await requirePrinter(qz, printer);
  await qz.print(qz.configs.create(printer, { jobName: 'Pharm printer test' }), [{
    type: 'pixel', format: 'html', flavor: 'plain',
    data: '<html><body><h3>Pharm printer test</h3><p>0123456789</p><p>Printer driver connection test</p></body></html>',
  }]);
}

// Exported protocol operation allows verification without actuating real hardware.
export async function sendDrawerCommand(qz: QzBridge, settings: CounterHardware) {
  if (settings.drawer === 'none') throw new Error('No cash drawer configured on this counter. Open Settings → Printers & Cash Drawer.');
  const setupError = drawerSetupError(settings);
  if (setupError) throw new Error(setupError);
  const hex = commandHex(settings.command);
  if (settings.drawer === 'printer') {
    await requirePrinter(qz, settings.drawerPrinter);
    await qz.print(qz.configs.create(settings.drawerPrinter, { jobName: 'Pharm cash drawer' }),
      [{ type: 'raw', format: 'command', flavor: 'hex', data: hex }]);
  } else {
    if (!settings.port || !(await qz.serial.findPorts()).includes(settings.port)) throw new Error('Selected cash drawer serial port is unavailable.');
    await qz.serial.openPort(settings.port, { baudRate: settings.baudRate, dataBits: 8, stopBits: 1, parity: 'NONE', flowControl: 'NONE' });
    try { await qz.serial.sendData(settings.port, { type: 'HEX', data: hex }); }
    finally { await qz.serial.closePort(settings.port); }
  }
}

let drawerBusy = false;
export async function openCounterDrawer(settings = loadHardware()) {
  if (settings.drawer === 'none') throw new Error('No cash drawer configured on this counter. Open Settings → Printers & Cash Drawer.');
  const setupError = drawerSetupError(settings);
  if (setupError) throw new Error(setupError);
  if (drawerBusy) throw new Error('A drawer command is already in progress.');
  drawerBusy = true;
  try { await sendDrawerCommand(await connectHardware(), settings); }
  finally { drawerBusy = false; }
}

export async function pdfBlobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Unable to read receipt PDF.'));
    reader.readAsDataURL(blob);
  });
}
