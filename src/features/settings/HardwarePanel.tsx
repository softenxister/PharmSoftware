import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { commandHex, discoverHardware, drawerSetupError, loadHardware, openCounterDrawer, saveHardware, testCounterPrinter, type CounterHardware } from '../hardware/counterHardware';
import styles from './Settings.module.css';

function Choice({ label, value, items, onChange, disabled }: {
  label: string; value: string; items: { value: string; label: string }[];
  onChange: (value: string) => void; disabled?: boolean;
}) {
  return <div className={styles.hardwareField}>
    <span>{label}</span>
    <Select value={value || '__none'} onValueChange={v => onChange(v === '__none' ? '' : v)} disabled={disabled}>
      <SelectTrigger className={styles.hardwareSelectTrigger} aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent
        className={styles.hardwareSelectMenu}
        position="popper"
        side="bottom"
        align="start"
        sideOffset={4}
        avoidCollisions={false}
      >
        {items.map(item => <SelectItem className={styles.hardwareSelectItem} key={item.value} value={item.value}>{item.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}

export function HardwarePanel() {
  const [settings, setSettings] = useState(loadHardware);
  const [printers, setPrinters] = useState<string[]>([]);
  const [ports, setPorts] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!window.qz?.websocket.isActive()) setConnected(false);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const update = (patch: Partial<CounterHardware>) => {
    setSettings(current => ({ ...current, ...patch })); setDirty(true); setMessage(''); setError('');
  };
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setConnected(!!window.qz?.websocket.isActive()); setBusy(false); }
  }
  const printerOptions = (selected: string) => [
    { value: '__none', label: 'None / browser print dialog' },
    ...[...new Set([...printers, ...(selected ? [selected] : [])])].map(value => ({ value, label: printers.includes(value) ? value : `${value} (not discovered)` })),
  ];
  const validDrawer = settings.drawer === 'printer' ? printers.includes(settings.drawerPrinter)
    : settings.drawer === 'serial' ? ports.includes(settings.port) : false;
  let commandValid = true;
  try { commandHex(settings.command); } catch { commandValid = false; }
  const setupError = drawerSetupError(settings);
  function saveCounterSetup() {
    setError(''); setMessage('');
    try {
      saveHardware(settings);
      setDirty(false);
      setMessage(setupError
        ? `Counter setup saved in this browser. Cash drawer is not ready: ${setupError}`
        : 'Counter setup saved in this browser.');
    } catch {
      setError('Could not save counter setup. Allow this site to store browser data, then try again. Your changes are still shown here.');
    }
  }

  return <section className={styles.panel}>
    <div className={styles.panelHeader}><div>
      <h2 className={styles.panelTitle}>Printers & Cash Drawer</h2>
      <p className={styles.panelDescription}>Connect hardware on this counter. Selections are saved in this browser only.</p>
    </div></div>
    <div className={styles.hardwareBody}>
      <div className={styles.hardwareHelp}>
        <strong>Local hardware connection</strong>
        <p>Install your printer’s Windows, macOS or Linux driver, then install and start <a href="https://qz.io/download/" target="_blank" rel="noreferrer">QZ Tray</a> on the PC running this browser. Once this counter trusts Pharm’s signing certificate, receipt printing runs without repeated approval prompts.</p>
        <p>Wiring alone does not guarantee compatibility. Printers need a working driver. Drawers connected to a printer need its drawer command; direct USB drawers need a compatible serial/print driver. Proprietary USB/HID drawers need a manufacturer integration.</p>
      </div>
      <div className={styles.hardwareActions}>
        <span role="status">{connected ? 'Local bridge connected' : 'Local bridge not connected'}</span>
        <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void run(async () => {
          setPrinters([]); setPorts([]);
          const devices = await discoverHardware();
          setPrinters(devices.printers); setPorts(devices.ports);
          setMessage(`${devices.printers.length} installed printer(s), ${devices.ports.length} serial port(s) found. Installed devices may be offline; test them below.`);
          if (devices.portError) setError(`Serial discovery failed: ${devices.portError}`);
        })}>{busy ? 'Working…' : connected ? 'Refresh devices' : 'Connect & find devices'}</button>
      </div>
      <div className={styles.hardwareSection}>
        <h3 className={styles.preferenceTitle}>Receipt printer</h3>
        <Choice label="Installed printer" value={settings.printer} items={printerOptions(settings.printer)} onChange={printer => update({ printer })} disabled={busy} />
        <p className={styles.preferenceDescription}>Paid receipt PDFs use this printer. With no printer selected, printing opens the browser dialog. Paper width is set in POS preferences; match the driver’s paper size.</p>
        <button type="button" className={styles.secondaryButton} disabled={busy || !connected || !printers.includes(settings.printer)} onClick={() => void run(async () => {
          await testCounterPrinter(settings.printer); setMessage('Test job submitted. Check the paper output; submission does not confirm physical printing.');
        })}>Print test page</button>
      </div>
      <div className={styles.hardwareSection}>
        <h3 className={styles.preferenceTitle}>Cash drawer</h3>
        <Choice label="Drawer connection" value={settings.drawer} disabled={busy} items={[
          { value: 'none', label: 'No cash drawer' }, { value: 'printer', label: 'Printer drawer port / raw print driver' }, { value: 'serial', label: 'Direct serial / USB-to-serial' },
        ]} onChange={drawer => update({ drawer: drawer as CounterHardware['drawer'], command: drawer === 'serial' ? '' : '1B 70 00 19 FA' })} />
        {settings.drawer === 'printer' && <Choice label="Drawer command printer" value={settings.drawerPrinter} items={printerOptions(settings.drawerPrinter)} onChange={drawerPrinter => update({ drawerPrinter })} disabled={busy} />}
        {settings.drawer === 'serial' && <>
          <Choice label="Serial port" value={settings.port} disabled={busy} items={[
            { value: '__none', label: 'Select a port' },
            ...[...new Set([...ports, ...(settings.port ? [settings.port] : [])])].map(value => ({ value, label: ports.includes(value) ? value : `${value} (not discovered)` })),
          ]} onChange={port => update({ port })} />
          <Choice label="Baud rate (8 data bits, no parity, 1 stop bit)" value={String(settings.baudRate)} disabled={busy} items={[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map(v => ({ value: String(v), label: String(v) }))} onChange={v => update({ baudRate: Number(v) })} />
        </>}
        {settings.drawer !== 'none' && <>
          <label className={styles.hardwareField}>Open command (hexadecimal bytes)
            <input value={settings.command} disabled={busy} maxLength={768} onChange={e => update({ command: e.target.value })} aria-invalid={!commandValid} spellCheck={false} />
          </label>
          <p className={styles.preferenceDescription}>Use the manufacturer’s command. ESC/POS pin 2 commonly uses 1B 70 00 19 FA; pin 5 uses 1B 70 01 19 FA. These commands do not apply to every direct USB drawer. Confirm the port and command before testing.</p>
          <button type="button" className={styles.secondaryButton} disabled={busy || !connected || !validDrawer || !commandValid} onClick={() => void run(async () => {
            await openCounterDrawer(settings); setMessage('Drawer command sent. Check that the drawer physically opened; this connection does not report its open/closed state.');
          })}>Test: open cash drawer</button>
        </>}
        <p className={styles.preferenceDescription}>Automatic opening follows the POS “Open cash drawer after payment” setting, for completed cash payments only.</p>
        {setupError && <p className={styles.hardwareError} role="status">Cash drawer is not ready: {setupError} You can save now and finish this later.</p>}
      </div>
      <div className={styles.hardwareActions}>
        <button type="button" className={styles.primaryButton} onClick={saveCounterSetup}>Save counter setup</button>
        {dirty && <span>Unsaved changes</span>}
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" className={styles.hardwareError}>{error}</p>}
    </div>
  </section>;
}
