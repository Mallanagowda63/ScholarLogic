// `npm run biometric:punch -- <PIN> [IN|OUT] [--time "YYYY-MM-DD HH:mm:ss"] [--server http://localhost:5000]`
// Pretends to be the eSSL S990: does the ADMS handshake and pushes one punch, exactly as the machine would.
// Without --time the punch is stamped "now" in device time (IST by default).
import 'dotenv/config';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};

const server = (flag('server') || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
const serial = flag('sn') || (process.env.BIOMETRIC_DEVICE_SERIALS || 'CUB7254300566').split(',')[0].trim();
const offsetMin = Number(process.env.BIOMETRIC_TZ_OFFSET_MINUTES || 330);
const time = flag('time') || new Date(Date.now() + offsetMin * 60000).toISOString().replace('T', ' ').slice(0, 19);
const [pin, dir = 'IN'] = args;

if (!pin || !/^(IN|OUT)$/i.test(dir) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(time)) {
  console.log('Usage: npm run biometric:punch -- <PIN> [IN|OUT] [--time "YYYY-MM-DD HH:mm:ss"] [--server URL]');
  process.exit(1);
}

(async () => {
  const hs = await fetch(`${server}/iclock/cdata?SN=${serial}&options=all`);
  if (!hs.ok) throw new Error(`Handshake refused (${hs.status}): ${await hs.text()}`);

  // ATTLOG line: PIN, time, state (0 = check-in, 1 = check-out), verify mode (1 = fingerprint)
  const line = `${pin}\t${time}\t${dir.toUpperCase() === 'IN' ? 0 : 1}\t1\t0\t0\n`;
  const res = await fetch(`${server}/iclock/cdata?SN=${serial}&table=ATTLOG&Stamp=${Date.now()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: line,
  });
  console.log(`${dir.toUpperCase()} punch for ${pin} at ${time} → ${server}: ${res.status} ${await res.text()}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
