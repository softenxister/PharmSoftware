# Counter printer and cash drawer setup

Settings → Printers & Cash Drawer connects to **the PC running the browser** through QZ Tray, including when Pharm is hosted elsewhere. It does not enumerate devices on the application server. Device selections live in this browser's local storage and must be configured separately on each counter/browser profile.

1. Install the manufacturer's printer driver and verify its Windows/macOS/Linux test page.
2. Install and launch [QZ Tray](https://qz.io/download/) on the counter PC.
3. Open the hardware settings, click **Connect & find devices**, and allow the site's QZ connection request.
4. Select the receipt printer and print a test page. Match the driver's paper width to POS preferences (58 or 80 mm).
5. Select the drawer's transport and manufacturer-specified command. Test opening, then save the counter setup.

On Windows, `scripts/hardware/install-qz-windows.ps1` downloads the official QZ Tray 2.2.5 installer, verifies its Authenticode signature, installs it, and launches the bridge. Windows may request administrator approval. This is a separate local software installation, not an application-server deployment.

Printer discovery lists OS print queues, including virtual printers and offline queues. A submitted job does not prove that paper printed. A drawer command does not prove that the drawer opened.

Saving does not require an active bridge or a fresh discovery. An unfinished drawer setup can be saved alongside the printer selection; settings show what is missing, and drawer commands remain blocked until its destination and command are valid. Browser storage failures are reported without discarding the edited fields.

## Compatibility

- PDF receipts use the OS printer driver. Embedded receipt fonts are retained. The printer must have a driver that accepts PDF/pixel printing; raw-only drivers cannot print these PDFs.
- Printer-connected drawers use the selected raw print queue. ESC/POS pin 2 commonly uses `1B 70 00 19 FA`; pin 5 uses `1B 70 01 19 FA`. Consult the printer's manual for supported pulse timing and connector.
- Direct serial and USB-to-serial drawers use an OS serial port, selectable baud rate and 8-N-1 without flow control. Enter the drawer manufacturer's binary open command. An adapter being present does not identify the attached device.
- Direct proprietary USB/HID drawers, devices requiring serial control-line pulses or different serial framing, and raw-only printers need a manufacturer-specific integration or supported driver. No single protocol covers every wired device.
- The browser print dialog remains available when no default printer is selected and as an explicit fallback after a direct-print error. Failed commands are never automatically retried, since that can duplicate physical output.

Automatic drawer opening runs after a successfully saved, fully tendered cash payment and respects the existing POS automatic-opening and “No Cash Drawer” settings. A hardware failure does not undo or resubmit the paid sale. Reprinting a receipt never opens the drawer.

## This Acer Windows counter

Read-only Windows inspection found `EPSON TM-T82X Receipt` with driver `EPSON TM-T(203dpi) Receipt6`, USB port `TMUSB001`, and a `Prolific USB-to-Serial Comm Port (COM4)` adapter. QZ Tray 2.2.5 was subsequently installed using the verified signed installer and launch was requested. COM4's attached device and open command still need confirmation; it is not automatically assigned as a drawer. Physical output has not yet been verified.

## Bridge distribution and approvals

The unmodified official QZ Tray JavaScript library, version 2.2.5, is vendored at `public/vendor/qz-tray/qz-tray.js` with LGPL-2.1 license. Source: https://github.com/qzind/tray/blob/v2.2.5/js/qz-tray.js . No runtime CDN request or npm dependency is needed.

Requests are signed by the authenticated server and trusted once on each counter. The server validates the full QZ request before hashing/signing it; only printer discovery, receipt/test output and the configured serial operations are accepted. Cross-origin requests, expired requests, file/socket destinations and external document URLs are rejected. The private key is never sent to the browser or copied into QZ Tray.

To configure silent printing:

1. Run `bash scripts/hardware/create-qz-signing.sh` on the application server. It creates `.local/qz-signing/certificate.pem` and `private-key.pem` with restricted permissions, excluded from Git. Existing keys are preserved.
2. On each Windows counter run `scripts/hardware/trust-pharm-qz-windows.ps1 -CertificatePath <public-certificate.pem>`. This installs the public certificate into QZ's supported `override.crt` location, allows that identity using QZ's CLI and restarts QZ. Windows administrator approval may be required once. A different existing override is preserved and reported as a conflict.
3. Reload Pharm. Connection, discovery and print requests now carry the trusted certificate/signature. Other websites do not gain unsigned access.

Deploy the two server credential files securely with the API server. `PHARM_QZ_SIGNING_DIR` can select a private directory outside the repository. If a proxy rewrites the Host header, set `PHARM_PUBLIC_ORIGIN` to the exact browser-facing origin. A missing/expired certificate stops hardware authorization with an error rather than silently falling back to unsigned prompts. The generated certificate expires after ten years; rotate it and update trust on each counter before expiry. macOS/Linux counters can use the same public certificate with QZ's documented CA and certificate provisioning. Production CSP permits only QZ's four localhost secure WebSocket ports.

References: [QZ getting started](https://qz.io/docs/getting-started), [PDF printing](https://qz.io/docs/pixel), [serial API](https://qz.io/api/qz.serial), [raw printing](https://qz.io/docs/raw).

Protocol checks: `node --import tsx --test src/features/hardware/counterHardware.test.ts`.
