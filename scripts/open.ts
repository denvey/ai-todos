import { spawn } from 'node:child_process';
import { ensureService } from '../src/service-client.ts';
const { origin } = await ensureService();
console.log(origin);
const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
spawn(command, [origin], { stdio: 'ignore' }).on('error', () => console.error('Open the URL above in your browser.'));
