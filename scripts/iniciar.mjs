import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(project);
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 10)) throw new Error('Use Node.js 24.10 ou posterior.');
await import('../server/index.mjs');
const origin = process.env.APP_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3000}`;
if (!process.argv.includes('--no-browser')) {
  const url = new URL('/login/', origin).href;
  setTimeout(() => {
    if (process.platform === 'win32') {
      const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true, detached: true, stdio: 'ignore' });
      child.on('error', () => console.log('Abra no navegador: ' + url)); child.unref();
    } else console.log('Abra no navegador: ' + url);
  }, 700).unref();
}
