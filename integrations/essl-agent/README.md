# ScholarLogic eSSL campus helper

The ScholarLogic server is on the internet and cannot reach the eSSL attendance machine inside the campus
network. This helper runs on a campus computer, reads the machine every 5 minutes (read-only, nothing on
the machine changes, eSSL Web keeps working) and sends new punches to the server.

If the computer or the internet is off, punches stay on the machine and are sent on the next run.

## Requirements

- A Windows computer on the campus network that stays on (the same network as the machine, e.g. 192.168.1.x)
- Node.js 18 or newer: https://nodejs.org (LTS installer, default options)

## Install (5 minutes)

1. Copy this `essl-agent` folder to the computer, e.g. `C:\ScholarLogic\essl-agent`.
2. Copy `agent.config.example.json` to `agent.config.json` and fill in:
   - `secret`: the `ESSL_AGENT_SECRET` value from the server's `backend/.env` (ask the admin)
   - `deviceHost`: the machine's IP (Menu → COMM. → Ethernet on the machine, e.g. `192.168.1.35`)
   - `serverUrl`: the LMS address, e.g. `https://scholarlogiclms.in`
3. Right-click `install-windows.bat` and choose **Run as administrator**.
   It tests one read and one send, then sets the helper to start whenever the computer starts.

Check it in the LMS: **Admin → eSSL Integration → Review queue**, which shows "Campus helper, last report …".

## Notes

- Log: `agent.log` in this folder.
- Test by hand: `node essl-agent.js --once`
- Remove: right-click `uninstall-windows.bat` and choose **Run as administrator**.
- If the machine's IP changes (DHCP), update `deviceHost` and restart the computer. Better: reserve the
  machine's IP in the router.
