const { spawn } = require('node:child_process');
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','--port','3100'], {env:{...process.env,CRM_BUILD_DIR:'.next-smoke'},stdio:['ignore','pipe','pipe']});
let testing = false;
let result = 1;
let stopping = false;
const stop = () => { if (!stopping) { stopping = true; server.kill(); } };
const timeout = setTimeout(() => { console.error('Fresh server check timed out'); stop(); }, 120000);
function output(chunk) {
  const message = chunk.toString();
  process.stdout.write(message);
  if (!testing && message.includes('Ready in')) {
    testing = true;
    const check = spawn(process.execPath,['scripts/check-pages.cjs','3100'],{stdio:'inherit'});
    check.on('exit', code => {result = code || 0; stop();});
  }
}
server.stdout.on('data', output);
server.stderr.on('data', output);
server.on('exit', () => {clearTimeout(timeout);process.exitCode=result;});
process.on('SIGINT', stop);
