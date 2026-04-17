import { spawn } from 'child_process';
import fs from 'fs';

const prompt = fs.readFileSync('C:/Users/X99-F8/AppData/Local/Temp/full-concept-prompt.txt', 'utf8');

const env = { ...process.env };
delete env.CLAUDECODE;

console.log(`prompt length: ${prompt.length}`);

const args = ["-p", "--model", "opus", "--output-format", "text"];
const child = spawn("claude", args, {
  env,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

let stdout = "";
let stderr = "";
child.stdout.on("data", d => { stdout += d.toString(); process.stderr.write('.'); });
child.stderr.on("data", d => { stderr += d.toString(); });
child.on("close", code => {
  console.log(`\nclose code=${code}`);
  console.log(`stdout len=${stdout.length}`);
  console.log(`stderr len=${stderr.length}`);
  if (stderr) console.log(`STDERR: ${stderr.slice(0, 500)}`);
  if (stdout) console.log(`STDOUT preview: ${stdout.slice(0, 200)}`);
});
child.on('error', err => console.log('spawn error:', err.message));

child.stdin.write(prompt);
child.stdin.end();
