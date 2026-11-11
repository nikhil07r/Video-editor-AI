const { spawn, execSync } = require('child_process');
const fs = require('fs');

const pproExe = 'C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\Adobe Premiere Pro.exe';

console.log('Activating Adobe Premiere Pro...');

// 1. Launch or bring to front
if (fs.existsSync(pproExe)) {
    spawn(pproExe, [], { detached: true, stdio: 'ignore' }).unref();
}

// 2. Bring window to foreground using Windows VBScript Shell
const vbsPath = 'C:\\VideoEditorAI\\scratch\\focus_premiere.vbs';
const vbsScript = [
    'Set sh = CreateObject("WScript.Shell")',
    'sh.AppActivate "Adobe Premiere Pro"',
    'WScript.Sleep 200',
    'sh.AppActivate "Premiere Pro"'
].join('\r\n');

fs.writeFileSync(vbsPath, vbsScript, 'utf8');

try {
    execSync('cscript //nologo "' + vbsPath + '"');
} catch (e) {}

console.log('Adobe Premiere Pro activated on screen.');
