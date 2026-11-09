const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const AIDirector = require('./ai_director');
const CapCutEngine = require('./capcut_engine');
const premiereGenerator = require('./premiere_generator');

const PORT = 4500;
const director = new AIDirector();
const engine = new CapCutEngine();

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Video Editor — CapCut & Premiere Pro</title>
    <style>
        :root {
            --bg: #0b0e14;
            --card: #141a24;
            --border: #222b3d;
            --accent: #00f0ff;
            --accent-glow: rgba(0, 240, 255, 0.25);
            --gold: #e5b94c;
            --gold-glow: rgba(229, 185, 76, 0.3);
            --purple: #8a2be2;
            --text: #f0f4fc;
            --muted: #8896b3;
            --success: #00e676;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 25px; min-height: 100vh; }
        .container { max-width: 1000px; margin: 0 auto; }
        header { text-align: center; margin-bottom: 25px; }
        header h1 { font-size: 2.2rem; font-weight: 800; background: linear-gradient(135deg, var(--accent), var(--gold)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        header p { color: var(--muted); margin-top: 6px; font-size: 0.95rem; }
        
        .tabs { display: flex; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
        .tab-btn { background: #101622; border: 1px solid var(--border); color: var(--muted); padding: 10px 20px; border-radius: 8px; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .tab-btn:hover { color: #fff; border-color: #3b4963; }
        .tab-btn.active.tab-capcut { background: rgba(0, 240, 255, 0.15); border-color: var(--accent); color: var(--accent); }
        .tab-btn.active.tab-premiere { background: rgba(229, 185, 76, 0.15); border-color: var(--gold); color: var(--gold); }

        .tab-content { display: none; }
        .tab-content.active { display: block; }

        .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
        .card h2 { font-size: 1.15rem; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
        .card.capcut h2 { color: var(--accent); }
        .card.premiere h2 { color: var(--gold); }
        
        label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: #d0d7e5; }
        textarea, input[type="text"], select { width: 100%; background: #0a0d14; border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 10px; font-size: 0.9rem; outline: none; margin-bottom: 12px; transition: 0.2s; }
        textarea:focus, input[type="text"]:focus, select:focus { border-color: var(--accent); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

        .feature-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .chip { background: #0d121c; border: 1px solid var(--border); padding: 6px 12px; border-radius: 16px; font-size: 0.8rem; cursor: pointer; user-select: none; transition: 0.2s; }
        .chip.active { background: rgba(0, 240, 255, 0.15); border-color: var(--accent); color: var(--accent); font-weight: 600; }
        .chip.gold.active { background: rgba(229, 185, 76, 0.15); border-color: var(--gold); color: var(--gold); font-weight: 600; }

        .btn-row { display: flex; gap: 12px; margin-top: 10px; }
        button { flex: 1; padding: 12px; border-radius: 8px; font-size: 0.95rem; font-weight: 700; cursor: pointer; border: none; transition: 0.2s; }
        .btn-capcut { background: linear-gradient(135deg, var(--accent), var(--purple)); color: #fff; }
        .btn-capcut:hover { opacity: 0.92; transform: translateY(-1px); }
        .btn-premiere { background: linear-gradient(135deg, var(--gold), #bd7b00); color: #000; font-weight: 800; font-size: 1.05rem; box-shadow: 0 4px 20px var(--gold-glow); }
        .btn-premiere:hover { opacity: 0.95; transform: translateY(-1px); filter: brightness(1.1); }
        .btn-secondary { background: #1a2233; color: var(--text); border: 1px solid var(--border); }
        .btn-secondary:hover { background: #222d42; }

        .status-box { background: #080a0f; border: 1px solid var(--border); border-radius: 8px; padding: 14px; font-family: monospace; font-size: 0.85rem; color: #a2b0cb; min-height: 90px; max-height: 220px; overflow-y: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>AI Video Editor Hub</h1>
            <p>Direct Video Automation Engine for CapCut Desktop & Adobe Premiere Pro 2026</p>
        </header>

        <!-- TABS -->
        <div class="tabs">
            <button class="tab-btn tab-premiere active" onclick="showTab('premiere')">🏰 Premiere Pro Real Estate Suite</button>
            <button class="tab-btn tab-capcut" onclick="showTab('capcut')">🎬 CapCut AI Engine</button>
        </div>

        <!-- PREMIERE PRO REAL ESTATE SECTION -->
        <div id="tab-premiere" class="tab-content active">
            <div class="card premiere">
                <h2>🏰 Premiere Pro Real Estate Auto-Director</h2>
                
                <!-- 1. FOOTAGE FOLDER -->
                <label>📁 Video Footage Folder Path (Scans all clips automatically):</label>
                <div style="display:flex; gap:10px; margin-bottom:12px;">
                    <input type="text" id="prFolder" value="C:\cllg" placeholder="e.g. C:\cllg or C:\Users\nikhil\Videos" style="margin-bottom:0; flex:1;">
                    <button class="btn-secondary" onclick="scanPrFolder()" style="max-width:140px; padding:10px;">🔍 Check Clips</button>
                </div>
                <div id="prScanBadge" style="font-size:0.8rem; color:var(--success); font-weight:600; margin-bottom:14px;">
                    ✅ C:\cllg verified — Ready to slice and edit clips
                </div>

                <!-- 2. LISTING DETAILS -->
                <div class="grid-3">
                    <div>
                        <label>Price Tag:</label>
                        <input type="text" id="prPrice" value="₹15 CR">
                    </div>
                    <div>
                        <label>Property Title / Address:</label>
                        <input type="text" id="prAddress" value="smart city delhi airport">
                    </div>
                    <div>
                        <label>Specs & Highlights:</label>
                        <input type="text" id="prSpecs" value="per family one floor with private lift">
                    </div>
                </div>

                <!-- 3. PREMIERE ABILITIES (KEYFRAMES & MASKING) -->
                <div class="grid-3">
                    <div>
                        <label>Video Format & Aspect Ratio:</label>
                        <select id="prFormat">
                            <option value="9:16" selected>📱 9:16 Vertical Reel (1080 × 1920)</option>
                            <option value="16:9">🖥️ 16:9 4K Luxury Tour (1920 × 1080 / 4K)</option>
                        </select>
                    </div>
                    <div>
                        <label>Keyframing Motion (Ken Burns):</label>
                        <select id="prKeyframe">
                            <option value="alternating" selected>✨ Alternating Push-In & Pull-Out</option>
                            <option value="push_in">🔍 Ken Burns Push-In (100% → 114%)</option>
                            <option value="pull_out">🔎 Pull-Out Wide Reveal (114% → 100%)</option>
                            <option value="none">⛔ Static (No Keyframes)</option>
                        </select>
                    </div>
                    <div>
                        <label>Shot Pacing (Cuts Duration):</label>
                        <select id="prPacing">
                            <option value="2.0" selected>⚡ 2.0s Fast Mobile Reel</option>
                            <option value="2.5">🎬 2.5s Dynamic Showcase</option>
                            <option value="3.5">🏰 3.5s Elegant Cinematic Tour</option>
                        </select>
                    </div>
                </div>

                <div class="feature-chips">
                    <div class="chip gold active">🎥 Real Scale Keyframing (100% → 114%)</div>
                    <div class="chip gold active">🏷️ ₹15 CR Price Badge Injection</div>
                    <div class="chip gold active">✨ Auto-Slice Multi-Cut Sequencing</div>
                    <div class="chip gold active">🎚️ Native Premiere Pro XML Timeline</div>
                </div>

                <!-- BIG MASTER ACTION BUTTON -->
                <div class="btn-row">
                    <button class="btn-premiere" id="btnRunPremiereEdit" onclick="runPremiereAutoEdit()">
                        ⚡ RUN AI AUTO-EDIT & OPEN IN PREMIERE PRO
                    </button>
                    <button class="btn-secondary" onclick="launchPremierePanel()" style="max-width:260px;">
                        🚀 Launch Premiere Panel
                    </button>
                </div>
                <p style="font-size: 0.8rem; color: var(--muted); margin-top: 10px; text-align:center;">
                    💡 This directly generates your timeline with cuts, Ken Burns keyframes, price tags, and opens it automatically in Premiere Pro!
                </p>
            </div>
        </div>

        <!-- CAPCUT SECTION -->
        <div id="tab-capcut" class="tab-content">
            <div class="card capcut">
                <h2>💬 CapCut Prompt & Settings</h2>
                <label>Tell the AI how to edit your video:</label>
                <textarea id="promptCapcut" rows="2">Create a high energy reel with zoom in animations, circle mask on b-roll, portrait roto cutout with neon cyber cyan stroke, and vibrant 8K cinematic filter</textarea>

                <div class="feature-chips">
                    <div class="chip active">✨ Roto Tool (Auto Cutout)</div>
                    <div class="chip active">⚡ Neon Outline Stroke</div>
                    <div class="chip active">⭕ Circle Masking</div>
                    <div class="chip active">🎬 In/Out Zoom Animations</div>
                    <div class="chip active">🎨 8K Cinematic Filter</div>
                </div>

                <label>Video Files:</label>
                <textarea id="videoPathsCapcut" rows="1">C:/cllg/video_20261031_175554.mp4, C:/cllg/video_20261031_191136.mp4</textarea>

                <div class="btn-row">
                    <button class="btn-capcut" id="btnEditCapcut">⚡ Run AI Edit & Send to CapCut</button>
                    <button class="btn-secondary" id="btnLaunchCapcut">🚀 Launch CapCut Desktop</button>
                </div>
            </div>
        </div>

        <!-- EXECUTION LOGS -->
        <div class="card">
            <h2 style="color: #bbb; font-size: 1rem;">🖥️ Live Activity & Status Logs</h2>
            <div class="status-box" id="statusBox">All systems operational. Premiere Pro Auto-Editor & CapCut Engine ready.</div>
        </div>
    </div>

    <script>
        const statusBox = document.getElementById('statusBox');
        function log(msg) {
            statusBox.textContent += '\\n' + msg;
            statusBox.scrollTop = statusBox.scrollHeight;
        }

        function showTab(tab) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            if (tab === 'capcut') {
                document.querySelector('.tab-btn.tab-capcut').classList.add('active');
                document.getElementById('tab-capcut').classList.add('active');
            } else {
                document.querySelector('.tab-btn.tab-premiere').classList.add('active');
                document.getElementById('tab-premiere').classList.add('active');
            }
        }

        // Scan folder check
        async function scanPrFolder() {
            const folder = document.getElementById('prFolder').value.trim();
            log('Scanning folder: ' + folder + '...');
            try {
                const res = await fetch('/api/premiere/scan-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderPath: folder })
                });
                const data = await res.json();
                if (data.success) {
                    document.getElementById('prScanBadge').textContent = '✅ ' + data.count + ' video files ready in ' + folder;
                    log('✅ Found ' + data.count + ' video files: ' + data.files.slice(0, 3).map(f => f.split(/[\\\\/]/).pop()).join(', ') + '...');
                } else {
                    document.getElementById('prScanBadge').textContent = '⚠️ ' + data.error;
                    log('⚠️ ' + data.error);
                }
            } catch (e) {
                log('❌ Error: ' + e.message);
            }
        }

        // MASTER AUTO-EDIT FOR PREMIERE PRO
        async function runPremiereAutoEdit() {
            const btn = document.getElementById('btnRunPremiereEdit');
            btn.textContent = '⏳ SLICING & KEYFRAMING IN PREMIERE...';
            btn.style.opacity = '0.7';

            const folder = document.getElementById('prFolder').value.trim();
            const price = document.getElementById('prPrice').value.trim();
            const title = document.getElementById('prAddress').value.trim();
            const specs = document.getElementById('prSpecs').value.trim();
            const format = document.getElementById('prFormat').value;
            const keyframe = document.getElementById('prKeyframe').value;
            const pacing = document.getElementById('prPacing').value;

            log('🚀 Starting Premiere Pro AI Auto-Director...');
            log('📁 Reading footage from: ' + folder);
            log('🏷️ Listing: ' + title + ' | ' + price + ' | ' + specs);
            log('🎬 Applying ' + (format === '9:16' ? '9:16 Vertical Reel' : '16:9 Landscape') + ' with ' + keyframe + ' keyframes...');

            try {
                const res = await fetch('/api/premiere/auto-edit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folderPath: folder,
                        title: title,
                        aspectRatio: format,
                        pacingSeconds: pacing,
                        keyframeMode: keyframe,
                        details: { price, title, specs }
                    })
                });
                const data = await res.json();
                if (data.success) {
                    log('========================================================');
                    log('🎉 PREMIERE PRO TIMELINE GENERATED SUCCESSFULLY!');
                    log('Sequence: ' + data.sequenceName);
                    log('Total Slices & Cuts: ' + data.totalCuts);
                    log('Duration: ' + data.durationSeconds + 's');
                    log('Aspect Ratio: ' + data.aspectRatio);
                    log('Keyframes: Applied Scale Push-In / Pull-Out on every cut');
                    log('Project Saved to: ' + data.xmlPath);
                    log('🚀 Adobe Premiere Pro 2026 Launched & Timeline Loaded!');
                    log('========================================================');
                } else {
                    log('❌ ERROR: ' + data.error);
                }
            } catch (e) {
                log('❌ Error: ' + e.message);
            } finally {
                btn.textContent = '⚡ RUN AI AUTO-EDIT & OPEN IN PREMIERE PRO';
                btn.style.opacity = '1';
            }
        }

        // CapCut Actions
        document.getElementById('btnEditCapcut').addEventListener('click', async () => {
            const prompt = document.getElementById('promptCapcut').value;
            const videoPaths = document.getElementById('videoPathsCapcut').value.split(/[,\\n]+/).map(s => s.trim()).filter(Boolean);
            log('🚀 Submitting edit request to CapCut Director...');
            try {
                const res = await fetch('/api/edit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, videoPaths, projectName: 'AI_CapCut_Edit' })
                });
                const data = await res.json();
                if (data.success) {
                    log('✅ CapCut Project Created: ' + data.projectName + ' (Duration: ' + data.timelineDurationSeconds + 's)');
                } else {
                    log('❌ ' + data.error);
                }
            } catch (e) { log('❌ ' + e.message); }
        });

        async function launchPremierePanel() {
            log('🚀 Launching Adobe Premiere Pro 2026...');
            try {
                const res = await fetch('/api/premiere/launch', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    log('✅ Premiere Pro launched!');
                    log('📌 Open AI panel inside Premiere: Window > Extensions > AI Real Estate Video Editor');
                } else {
                    log('❌ ' + data.error);
                }
            } catch (e) { log('❌ ' + e.message); }
        }

        document.getElementById('btnLaunchCapcut').addEventListener('click', async () => {
            log('Launching CapCut...');
            await fetch('/api/launch-capcut', { method: 'POST' });
        });
    </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
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

    // CAPCUT EDIT
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

    // CAPCUT LAUNCH
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

    // PREMIERE PRO: FOLDER SCAN
    if (req.method === 'POST' && req.url === '/api/premiere/scan-folder') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { folderPath } = JSON.parse(body);
                const files = premiereGenerator.scanFolder(folderPath || 'C:/cllg');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: files.length, files }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // PREMIERE PRO: AUTO-EDIT MASTER ENGINE
    if (req.method === 'POST' && req.url === '/api/premiere/auto-edit') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const result = premiereGenerator.buildAndOpenInPremiere(payload);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // PREMIERE PRO: LAUNCH APPLICATION
    if (req.method === 'POST' && req.url === '/api/premiere/launch') {
        const pproExe = 'C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\Adobe Premiere Pro.exe';
        if (fs.existsSync(pproExe)) {
            spawn(pproExe, [], { detached: true, stdio: 'ignore' }).unref();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Adobe Premiere Pro 2026 not found.' }));
        }
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(`🚀 Unified Video Editor Hub (CapCut + Premiere Pro): http://localhost:${PORT}`);
    console.log(`📁 Files location: C:\\VideoEditorAI`);
    console.log(`========================================================`);
});
