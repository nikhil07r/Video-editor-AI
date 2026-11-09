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
        .btn-premiere { background: linear-gradient(135deg, var(--gold), #bd7b00); color: #000; }
        .btn-premiere:hover { opacity: 0.92; transform: translateY(-1px); }
        .btn-secondary { background: #1a2233; color: var(--text); border: 1px solid var(--border); }
        .btn-secondary:hover { background: #222d42; }

        .status-box { background: #080a0f; border: 1px solid var(--border); border-radius: 8px; padding: 14px; font-family: monospace; font-size: 0.85rem; color: #a2b0cb; min-height: 80px; max-height: 180px; overflow-y: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>AI Video Editor Hub</h1>
            <p>Dual Automation Engine for CapCut Desktop & Adobe Premiere Pro 2026</p>
        </header>

        <!-- TABS -->
        <div class="tabs">
            <button class="tab-btn active tab-capcut" onclick="showTab('capcut')">🎬 CapCut AI Engine</button>
            <button class="tab-btn tab-premiere" onclick="showTab('premiere')">🏰 Premiere Pro Real Estate Suite</button>
        </div>

        <!-- CAPCUT SECTION -->
        <div id="tab-capcut" class="tab-content active">
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

        <!-- PREMIERE PRO REAL ESTATE SECTION -->
        <div id="tab-premiere" class="tab-content">
            <div class="card premiere">
                <h2>🏰 Real Estate Premiere Pro Director</h2>
                
                <div class="grid-2">
                    <div>
                        <label>Target Format & Style:</label>
                        <select id="prFormat">
                            <option value="reel">📱 9:16 Viral Reel (TikTok / Instagram / Shorts) — 2.2s cuts</option>
                            <option value="landscape" selected>🏰 16:9 4K Luxury Property Tour (YouTube / Showcase) — 3.5s cuts</option>
                        </select>
                    </div>
                    <div>
                        <label>Cinematic Real Estate LUT (Color Grade):</label>
                        <select id="prLut">
                            <option value="RealEstate_Luxury_Warm.cube">🌅 Luxury Warm (Golden Hour & Ambient Glow)</option>
                            <option value="RealEstate_Clean_Interior.cube" selected>🏠 Clean Interior (Crisp Bright Whites, No Yellow Mud)</option>
                            <option value="RealEstate_Moody_Modern.cube">🏢 Moody Modern (Architectural Drama & Contrast)</option>
                        </select>
                    </div>
                </div>

                <div class="grid-3">
                    <div>
                        <label>Listing Price:</label>
                        <input type="text" id="prPrice" value="$3,250,000">
                    </div>
                    <div>
                        <label>Property Specs:</label>
                        <input type="text" id="prSpecs" value="5 Beds • 5.5 Baths • 5,400 SQ FT">
                    </div>
                    <div>
                        <label>Property Address / Title:</label>
                        <input type="text" id="prAddress" value="Beverly Hills Modern Estate">
                    </div>
                </div>

                <div class="feature-chips">
                    <div class="chip gold active">🎥 Ken Burns Smooth Slow Push-In</div>
                    <div class="chip gold active">🏷️ Automatic Property Badge Markers</div>
                    <div class="chip gold active">✨ Lumetri Color Grade Integration</div>
                    <div class="chip gold active">🎚️ Multi-Track Essential Sequencing</div>
                    <div class="chip gold active">🔊 4x Royalty-Free Cinematic SFX</div>
                    <div class="chip gold active">⚡ 9x Viral Engagement MOGRTs</div>
                </div>

                <div class="card" style="background: #0d121c; margin-top: 10px; margin-bottom: 14px;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--gold); margin-bottom: 6px;">🔥 9x Installed MOGRTs (Drag from Essential Graphics or 1-Click in Panel):</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 0.75rem; color: #bbb;">
                        <span style="background: #1a2233; padding: 3px 8px; border-radius: 4px;">⚡ Viral Retention Hook</span>
                        <span style="background: #1a2233; padding: 3px 8px; border-radius: 4px;">🔥 Just Listed Badge</span>
                        <span style="background: #1a2233; padding: 3px 8px; border-radius: 4px;">🏠 Luxury Estate Title</span>
                        <span style="background: #1a2233; padding: 3px 8px; border-radius: 4px;">💰 Price Tag Lower 3rd</span>
                        <span style="background: #1a2233; padding: 3px 8px; border-radius: 4px;">📋 Beds/Baths Specs</span>
                        <span style="background: #1a2233; padding: 3px 8px; border-radius: 4px;">✨ Amenity/Pool Callout</span>
                        <span style="background: #1a2233; padding: 3px 8px; border-radius: 4px;">❤️ Save for Inspo CTA</span>
                        <span style="background: #1a2233; padding: 3px 8px; border-radius: 4px;">🔔 Follow for More Tours</span>
                        <span style="background: #1a2233; padding: 3px 8px; border-radius: 4px;">👤 Agent & Broker Outro</span>
                    </div>
                </div>

                <label>Footage Files (separated by commas):</label>
                <textarea id="videoPathsPr" rows="1">C:/cllg/video_20261031_175554.mp4, C:/cllg/video_20261031_191136.mp4</textarea>

                <div class="btn-row">
                    <button class="btn-premiere" id="btnLaunchPremiere">🚀 Open Premiere Pro & In-App Extension</button>
                </div>
                <p style="font-size: 0.8rem; color: var(--muted); margin-top: 8px;">
                    💡 <b>Side-by-Side Collaboration:</b> Inside Premiere Pro, go to <b>Window > Extensions > AI Real Estate Video Editor</b> to control edits and fine-tune live on your timeline!
                </p>
            </div>
        </div>

        <!-- EXECUTION LOGS -->
        <div class="card">
            <h2 style="color: #bbb; font-size: 1rem;">🖥️ Live Activity & Status Logs</h2>
            <div class="status-box" id="statusBox">All systems operational. CapCut Engine & Premiere Pro Extension ready.</div>
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
                    log('✅ Project Created: ' + data.projectName + ' (Duration: ' + data.timelineDurationSeconds + 's)');
                    log('Features: Roto, Mask, Zoom In, Sharpen applied!');
                } else {
                    log('❌ ' + data.error);
                }
            } catch (e) { log('❌ ' + e.message); }
        });

        document.getElementById('btnLaunchCapcut').addEventListener('click', async () => {
            log('Launching CapCut...');
            await fetch('/api/launch-capcut', { method: 'POST' });
        });

        // Premiere Pro Actions
        document.getElementById('btnLaunchPremiere').addEventListener('click', async () => {
            log('🚀 Launching Adobe Premiere Pro 2026...');
            try {
                const res = await fetch('/api/premiere/launch', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    log('✅ Premiere Pro launching!');
                    log('📌 To open the AI panel: In Premiere Pro, click Window > Extensions > AI Real Estate Video Editor.');
                } else {
                    log('❌ ' + data.error);
                }
            } catch (e) { log('❌ ' + e.message); }
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

    // PREMIERE PRO LAUNCH
    if (req.method === 'POST' && req.url === '/api/premiere/launch') {
        const pproExe = 'C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\Adobe Premiere Pro.exe';
        if (fs.existsSync(pproExe)) {
            spawn(pproExe, [], { detached: true, stdio: 'ignore' }).unref();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Adobe Premiere Pro launched.' }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Adobe Premiere Pro.exe not found at standard path.' }));
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
