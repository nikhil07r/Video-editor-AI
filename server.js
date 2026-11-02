const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const AIDirector = require('./ai_director');
const CapCutEngine = require('./capcut_engine');

const PORT = 4500;
const director = new AIDirector();
const engine = new CapCutEngine();

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CapCut AI Director & Video Editor</title>
    <style>
        :root {
            --bg: #0c0f17;
            --card: #151b27;
            --border: #232d42;
            --accent: #00f0ff;
            --accent-glow: rgba(0, 240, 255, 0.25);
            --purple: #8a2be2;
            --text: #f0f4fc;
            --muted: #8896b3;
            --success: #00e676;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 30px; min-height: 100vh; }
        .container { max-width: 950px; margin: 0 auto; }
        header { text-align: center; margin-bottom: 30px; }
        header h1 { font-size: 2.2rem; font-weight: 800; background: linear-gradient(135deg, var(--accent), var(--purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        header p { color: var(--muted); margin-top: 8px; font-size: 1rem; }
        .badge { display: inline-block; background: #1a2333; color: var(--accent); padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; margin-top: 10px; border: 1px solid var(--border); }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 24px; margin-bottom: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
        .card h2 { font-size: 1.25rem; margin-bottom: 16px; color: var(--accent); display: flex; align-items: center; gap: 8px; }
        label { display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 8px; color: #d0d7e5; }
        textarea, input[type="text"] { width: 100%; background: #0a0d14; border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 12px; font-size: 0.95rem; outline: none; transition: 0.2s; }
        textarea:focus, input[type="text"]:focus { border-color: var(--accent); box-shadow: 0 0 10px var(--accent-glow); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
        .feature-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
        .chip { background: #101622; border: 1px solid var(--border); padding: 8px 14px; border-radius: 20px; font-size: 0.85rem; cursor: pointer; user-select: none; transition: 0.2s; display: flex; align-items: center; gap: 6px; }
        .chip.active { background: rgba(0, 240, 255, 0.15); border-color: var(--accent); color: var(--accent); font-weight: 600; }
        .btn-row { display: flex; gap: 14px; margin-top: 24px; }
        button { flex: 1; padding: 14px; border-radius: 10px; font-size: 1rem; font-weight: 700; cursor: pointer; border: none; transition: 0.2s; }
        .btn-primary { background: linear-gradient(135deg, var(--accent), var(--purple)); color: #fff; box-shadow: 0 6px 20px rgba(0, 240, 255, 0.3); }
        .btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
        .btn-secondary { background: #1a2233; color: var(--text); border: 1px solid var(--border); }
        .btn-secondary:hover { background: #222d42; }
        .status-box { background: #080a0f; border: 1px solid var(--border); border-radius: 8px; padding: 16px; font-family: monospace; font-size: 0.85rem; color: #a2b0cb; min-height: 80px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>CapCut AI Director & Local Engine</h1>
            <p>Direct Natural Language Video Automation running locally on your PC</p>
            <div class="badge">Connected to CapCut Desktop 9.6 • Location: C:\\VideoEditorAI</div>
        </header>

        <div class="card">
            <h2>💬 1. Natural Language Editing Prompt</h2>
            <label>Tell the AI how to edit your video:</label>
            <textarea id="prompt" rows="3" placeholder="e.g. Create a high energy reel with zoom in animations, circle mask on b-roll, portrait roto cutout with neon cyber cyan stroke, and vibrant 8K cinematic filter">Create a high energy reel with zoom in animations, circle mask, portrait roto cutout with neon cyber cyan stroke, and vibrant 8K cinematic filter</textarea>
            
            <div class="feature-chips">
                <div class="chip active" data-feature="roto">✨ Roto Tool (Auto Cutout)</div>
                <div class="chip active" data-feature="neonStroke">⚡ Neon Outline Stroke</div>
                <div class="chip active" data-feature="masking">⭕ Circle / Shape Masking</div>
                <div class="chip active" data-feature="animations">🎬 In / Out Zoom Animations</div>
                <div class="chip active" data-feature="filter">🎨 8K Cinematic Filter</div>
                <div class="chip active" data-feature="captions">📝 AI Captions Overlay</div>
            </div>
        </div>

        <div class="card">
            <h2>📁 2. Input Videos & Project Settings</h2>
            <label>Video Files (full paths separated by commas or newlines):</label>
            <textarea id="videoPaths" rows="2">C:/cllg/video_20261031_175554.mp4, C:/cllg/video_20261031_191136.mp4</textarea>

            <div class="grid-2">
                <div>
                    <label>Project Name:</label>
                    <input type="text" id="projectName" value="AI_CapCut_Project_01">
                </div>
                <div>
                    <label>Stroke Color (for Roto Cutout):</label>
                    <input type="text" id="strokeColor" value="#00F0FF">
                </div>
            </div>

            <div class="btn-row">
                <button class="btn-primary" id="btnEdit">⚡ Run AI Edit & Send to CapCut</button>
                <button class="btn-secondary" id="btnLaunch">🚀 Launch CapCut</button>
            </div>
        </div>

        <div class="card">
            <h2>🖥️ Live Execution Logs</h2>
            <div class="status-box" id="statusBox">System ready. Click "Run AI Edit & Send to CapCut" to generate your project.</div>
        </div>
    </div>

    <script>
        const statusBox = document.getElementById('statusBox');
        function log(msg) {
            statusBox.textContent += '\\n' + msg;
            statusBox.scrollTop = statusBox.scrollHeight;
        }

        // Toggle chips
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('active');
            });
        });

        document.getElementById('btnEdit').addEventListener('click', async () => {
            const prompt = document.getElementById('prompt').value;
            const videoPaths = document.getElementById('videoPaths').value.split(/[,\\n]+/).map(s => s.trim()).filter(Boolean);
            const projectName = document.getElementById('projectName').value;
            const strokeColor = document.getElementById('strokeColor').value;

            statusBox.textContent = '🚀 Submitting edit request to local AI Director...';
            try {
                const res = await fetch('/api/edit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, videoPaths, projectName, strokeColor })
                });
                const data = await res.json();
                if (data.success) {
                    log('✅ SUCCESS!');
                    log('Project Created: ' + data.projectName);
                    log('Draft Folder: ' + data.projectFolderPath);
                    log('Total Cuts: ' + data.recipeSummary.totalCuts);
                    log('Roto Tool: ' + (data.recipeSummary.featuresApplied.rotoTool ? 'Active' : 'Off'));
                    log('Masking: ' + (data.recipeSummary.featuresApplied.masking ? 'Active' : 'Off'));
                    log('Animations: ' + (data.recipeSummary.featuresApplied.animations ? 'Active' : 'Off'));
                    log('Filters: ' + (data.recipeSummary.featuresApplied.filterGrade ? 'Active' : 'Off'));
                    log('Registered in CapCut Home Screen. Open CapCut to view the timeline!');
                } else {
                    log('❌ ERROR: ' + data.error);
                }
            } catch (err) {
                log('❌ NETWORK ERROR: ' + err.message);
            }
        });

        document.getElementById('btnLaunch').addEventListener('click', async () => {
            log('Launching CapCut Desktop...');
            try {
                const res = await fetch('/api/launch-capcut', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    log('✅ CapCut opened successfully!');
                } else {
                    log('❌ Could not launch CapCut: ' + data.error);
                }
            } catch (err) {
                log('❌ Error: ' + err.message);
            }
        });
    </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HTML_PAGE);
        return;
    }

    if (req.method === 'GET' && req.url === '/api/drafts') {
        const drafts = engine.listDrafts();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, drafts }));
        return;
    }

    if (req.method === 'POST' && req.url === '/api/edit') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const { prompt, videoPaths, projectName, strokeColor } = payload;
                const result = await director.executeEditFromPrompt(prompt || '', videoPaths || [], {
                    projectName: projectName || `AI_Edit_${Date.now()}`,
                    strokeColor: strokeColor || '#00F0FF'
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/launch-capcut') {
        const capcutExe = path.join(process.env.LOCALAPPDATA, 'CapCut', 'Apps', 'CapCut.exe');
        if (fs.existsSync(capcutExe)) {
            spawn(capcutExe, [], { detached: true, stdio: 'ignore' }).unref();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'CapCut.exe not found' }));
        }
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(`🚀 CapCut AI Editor Web UI Running on: http://localhost:${PORT}`);
    console.log(`📁 Files location: C:\\VideoEditorAI`);
    console.log(`========================================================`);
});
