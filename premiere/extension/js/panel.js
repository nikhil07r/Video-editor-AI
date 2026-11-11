/**
 * Professional VideoEditorAI CEP Panel Controller
 * Handles: Local File Dialogs, Drag & Drop, Script Parsing, Interactive Storyboard,
 * Middle/End Trimming, Audio Muting/Extracting, and Premiere Timeline Execution.
 */

var csInterface = new CSInterface();
var selectedFiles = [];
var storyboardItems = [];
var activeRatio = '9:16';

// 1. FILE PICKER & FOLDER BROWSING
function browseVideoFiles() {
    try {
        if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog) {
            var result = window.cep.fs.showOpenDialog(
                true, // allowMultipleSelect
                false, // chooseDirectory
                "Select Video Clips",
                "C:\\",
                ["mp4", "mov", "mkv", "avi", "m4v"]
            );
            if (result && result.data && result.data.length > 0) {
                addFilesToList(result.data);
                return;
            }
        }
    } catch (e) {
        console.warn("CEP showOpenDialog failed:", e);
    }

    // Fallback: trigger hidden input file
    var picker = document.getElementById('hiddenFilePicker');
    if (picker) picker.click();
}

function browseVideoFolder() {
    try {
        if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog) {
            var result = window.cep.fs.showOpenDialog(
                false, // single
                true,  // chooseDirectory
                "Select Footage Folder",
                "C:\\",
                []
            );
            if (result && result.data && result.data.length > 0) {
                var folderPath = result.data[0];
                document.getElementById('folderInput').value = folderPath;
                scanLocalFolder(folderPath);
                return;
            }
        }
    } catch (e) {
        console.warn("CEP folder picker error:", e);
    }

    var folder = prompt("Enter folder path on your computer:", "C:\\cllg");
    if (folder) {
        document.getElementById('folderInput').value = folder;
        scanLocalFolder(folder);
    }
}

function handleFileInputChange(e) {
    if (e.target.files && e.target.files.length > 0) {
        var paths = [];
        for (var i = 0; i < e.target.files.length; i++) {
            var f = e.target.files[i];
            if (f.path) paths.push(f.path.replace(/\\/g, '/'));
            else paths.push(f.name);
        }
        addFilesToList(paths);
    }
}

function scanLocalFolder(folderPath) {
    var folder = folderPath || document.getElementById('folderInput').value.trim();
    if (!folder) return;

    logStatus("Scanning folder: " + folder + "...");

    // 1. Node.js direct scan if available in CEP
    try {
        if (typeof require !== 'undefined') {
            var fs = require('fs');
            var path = require('path');
            if (fs.existsSync(folder)) {
                var files = fs.readdirSync(folder);
                var videoExts = ['.mp4', '.mov', '.mkv', '.m4v', '.avi'];
                var found = [];
                files.forEach(function(f) {
                    var ext = path.extname(f).toLowerCase();
                    if (videoExts.indexOf(ext) !== -1) {
                        found.push(path.join(folder, f).replace(/\\/g, '/'));
                    }
                });
                if (found.length > 0) {
                    addFilesToList(found);
                    logStatus("✅ Found " + found.length + " video clips in " + folder);
                    return;
                }
            }
        }
    } catch (e) {
        console.log("Node scan fallback:", e);
    }

    // 2. ExtendScript scan fallback
    var call = '$realEstateHost.importFolderClips(' + JSON.stringify(folder) + ')';
    csInterface.evalScript(call, function(res) {
        try {
            var data = JSON.parse(res);
            if (data.success && data.files) {
                addFilesToList(data.files);
                logStatus("✅ " + data.message);
            } else {
                logStatus(data.message || "No files found.");
            }
        } catch (err) {
            logStatus("Scan error: " + res);
        }
    });
}

function addFilesToList(newFiles) {
    newFiles.forEach(function(file) {
        var normalized = file.replace(/\\/g, '/');
        if (selectedFiles.indexOf(normalized) === -1) {
            selectedFiles.push(normalized);
        }
    });
    updateFootageUI();
    generateDefaultStoryboard();
}

function clearFootageList() {
    selectedFiles = [];
    storyboardItems = [];
    updateFootageUI();
    renderStoryboardUI();
    logStatus("Cleared footage list.");
}

function updateFootageUI() {
    var statusText = document.getElementById('footageStatusText');
    var badge = document.getElementById('footageCountBadge');
    var list = document.getElementById('footageChipsList');

    if (badge) badge.textContent = selectedFiles.length + ' clips';

    if (selectedFiles.length === 0) {
        if (statusText) statusText.textContent = "No clips selected. Pick files or scan a folder.";
        if (list) list.innerHTML = '<div class="empty-state">📂 Click "Select Video Files" or drop videos here</div>';
    } else {
        if (statusText) statusText.textContent = "✅ " + selectedFiles.length + " clips ready to edit:";
        if (list) {
            list.innerHTML = selectedFiles.map(function(f, i) {
                var name = f.split('/').pop();
                return '<div class="chip-item">' +
                    '<span class="chip-name">' + (i + 1) + '. ' + name + '</span>' +
                    '<span class="chip-del" onclick="removeClip(' + i + ')">✕</span>' +
                '</div>';
            }).join('');
        }
    }
}

function removeClip(idx) {
    selectedFiles.splice(idx, 1);
    updateFootageUI();
    generateDefaultStoryboard();
}

// Read clips from active Premiere Pro project panel
function loadProjectClips() {
    logStatus("Reading clips from Premiere Pro Project Panel...");
    csInterface.evalScript('$realEstateHost.getProjectClips()', function(res) {
        try {
            var data = JSON.parse(res);
            if (data.success && data.clips && data.clips.length > 0) {
                var paths = data.clips.map(function(c) { return c.path || c.name; });
                addFilesToList(paths);
                logStatus("✅ Loaded " + data.clips.length + " clips from Premiere Project.");
            } else {
                logStatus("No clips found in active Premiere project bin.");
            }
        } catch (e) {
            logStatus("Error loading project clips: " + res);
        }
    });
}

// 2. SCRIPT & PROMPT AI DIRECTOR
function analyzeScriptAndGenerate() {
    var scriptText = document.getElementById('scriptPromptInput').value.trim();
    if (!scriptText) {
        alert("Please enter or paste your editing prompt or script.");
        return;
    }

    if (selectedFiles.length === 0) {
        alert("Please select or scan video clips first so the AI can assign them to your script.");
        return;
    }

    logStatus("🧠 Analyzing script beats, audio rules, and shot sections...");

    // Send to local generator parser
    try {
        if (typeof require !== 'undefined') {
            var pg = require('C:/VideoEditorAI/premiere_generator.js');
            var parsed = pg.parseScriptToStoryboard(scriptText, selectedFiles, {
                pacingSeconds: Number(document.getElementById('pacingSlider').value) || 2.2,
                details: {
                    price: document.getElementById('propPrice').value,
                    title: document.getElementById('propTitle').value,
                    specs: document.getElementById('propSpecs').value
                }
            });
            storyboardItems = parsed;
            renderStoryboardUI();
            switchTab('storyboard');
            logStatus("🎉 Analyzed " + parsed.length + " storyboard scenes from your script!");
            return;
        }
    } catch (e) {
        console.warn("Node parser fallback:", e);
    }

    // Client-side fallback parsing
    var lines = scriptText.split(/\n+/).map(function(l) { return l.trim(); }).filter(Boolean);
    storyboardItems = lines.map(function(line, idx) {
        var file = selectedFiles[idx % selectedFiles.length];
        var lower = line.toLowerCase();

        var section = 'middle';
        if (lower.indexOf('start') !== -1 || lower.indexOf('hook') !== -1) section = 'start';
        else if (lower.indexOf('end') !== -1 || lower.indexOf('last') !== -1) section = 'end';

        var audioMode = 'mute';
        if (lower.indexOf('audio only') !== -1 || lower.indexOf('voiceover') !== -1) audioMode = 'audio_only';
        else if (lower.indexOf('keep audio') !== -1 || lower.indexOf('original sound') !== -1) audioMode = 'both';

        var keyframe = (idx % 2 === 0) ? 'push_in' : 'pull_out';
        if (lower.indexOf('push') !== -1) keyframe = 'push_in';
        else if (lower.indexOf('pull') !== -1) keyframe = 'pull_out';
        else if (lower.indexOf('static') !== -1) keyframe = 'none';

        var mogrt = 'none';
        if (lower.indexOf('price') !== -1 || lower.indexOf('₹') !== -1 || lower.indexOf('cr') !== -1) mogrt = 'Real_Estate_Price_Tag';
        else if (lower.indexOf('title') !== -1 || lower.indexOf('airport') !== -1) mogrt = 'Real_Estate_Hero_Title';
        else if (lower.indexOf('spec') !== -1 || lower.indexOf('lift') !== -1) mogrt = 'Real_Estate_Property_Specs';
        else if (lower.indexOf('outro') !== -1) mogrt = 'Real_Estate_Agent_Outro';

        return {
            shotIndex: idx + 1,
            videoPath: file,
            fileName: file.split('/').pop(),
            pacingSeconds: Number(document.getElementById('pacingSlider').value) || 2.2,
            section: section,
            audioMode: audioMode,
            keyframe: keyframe,
            transition: idx === 0 ? 'none' : 'cross_dissolve',
            mogrt: mogrt,
            sfx: idx === 0 ? 'cinematic_whoosh.wav' : 'none',
            scriptBeat: line,
            customIn: 0,
            customOut: 2.2
        };
    });

    renderStoryboardUI();
    switchTab('storyboard');
    logStatus("🎉 Analyzed " + storyboardItems.length + " storyboard scenes from script!");
}

function setPresetScript(type) {
    var ta = document.getElementById('scriptPromptInput');
    if (!ta) return;
    if (type === 'reel') {
        ta.value = "Hook: Grand facade entrance with fast push-in and whoosh transition. Title: Smart City Delhi Airport\n" +
            "Scene 1: Middle part of living room, mute camera audio, luxury warm grade. Price: ₹15 CR\n" +
            "Scene 2: Middle section of private elevator, Specs: Per family one floor with private lift\n" +
            "Scene 3: Master bedroom highlight with smooth pull-out reveal.\n" +
            "Outro: Ending view of balcony terrace, contact broker card.";
    } else if (type === 'luxury') {
        ta.value = "Intro: Establishing drone view, cross dissolve, ambient audio.\n" +
            "Interior 1: Middle part of marble foyer, mute b-roll sound, clean interior grade.\n" +
            "Interior 2: Designer Italian modular kitchen, slow Ken Burns zoom.\n" +
            "Amenities: Private rooftop swimming pool with amber sunset look.\n" +
            "Closing: Price ₹15 CR and agent outro card.";
    } else if (type === 'teaser') {
        ta.value = "Beat 1: High energy hook banner, 2 cuts, whoosh SFX.\n" +
            "Beat 2: Middle part of living hall, mute audio, punchy zoom.\n" +
            "Beat 3: Just listed ribbon badge with ₹15 CR callout.\n" +
            "Beat 4: Call for private tour today.";
    }
}

// 3. STORYBOARD MANAGEMENT
function generateDefaultStoryboard() {
    if (selectedFiles.length === 0) {
        storyboardItems = [];
        renderStoryboardUI();
        return;
    }

    var pace = Number(document.getElementById('pacingSlider').value) || 2.2;
    var autoMute = document.getElementById('checkAutoMute') ? document.getElementById('checkAutoMute').checked : true;

    storyboardItems = selectedFiles.map(function(file, idx) {
        var isFirst = (idx === 0);
        var isSecond = (idx === 1);
        var isThird = (idx === 2);
        var isLast = (idx === selectedFiles.length - 1);

        var section = 'middle';
        var mogrt = 'none';
        var keyframe = (idx % 2 === 0) ? 'push_in' : 'pull_out';

        if (isFirst) {
            section = 'start';
            mogrt = 'Real_Estate_Hero_Title';
            keyframe = 'push_in';
        } else if (isSecond) {
            section = 'middle';
            mogrt = 'Real_Estate_Price_Tag';
        } else if (isThird) {
            section = 'middle';
            mogrt = 'Real_Estate_Property_Specs';
        } else if (isLast) {
            section = 'end';
            mogrt = 'Real_Estate_Agent_Outro';
        }

        return {
            shotIndex: idx + 1,
            videoPath: file,
            fileName: file.split('/').pop(),
            pacingSeconds: pace,
            section: section, // 'start', 'middle', 'end', 'custom'
            audioMode: autoMute ? 'mute' : 'both', // 'both', 'mute', 'audio_only'
            keyframe: keyframe,
            transition: isFirst ? 'none' : 'cross_dissolve',
            mogrt: mogrt,
            sfx: isFirst ? 'cinematic_whoosh.wav' : (isSecond ? 'cinematic_sub_boom.wav' : 'none'),
            customIn: 0,
            customOut: pace
        };
    });

    renderStoryboardUI();
}

function renderStoryboardUI() {
    var container = document.getElementById('storyboardList');
    var badge = document.getElementById('storyboardBadge');

    if (badge) badge.textContent = storyboardItems.length + ' cuts';
    if (!container) return;

    if (storyboardItems.length === 0) {
        container.innerHTML = '<div class="empty-state">No cuts in storyboard yet. Select clips or analyze a script.</div>';
        return;
    }

    container.innerHTML = storyboardItems.map(function(shot, idx) {
        return '<div class="storyboard-card">' +
            '<div class="card-top">' +
                '<span class="shot-num">#' + (idx + 1) + '</span>' +
                '<span class="shot-file" title="' + shot.videoPath + '">' + shot.fileName + '</span>' +
                '<span class="card-btn-del" onclick="deleteStoryboardItem(' + idx + ')">✕</span>' +
            '</div>' +

            (shot.scriptBeat ? '<div class="script-beat-tag">📝 ' + shot.scriptBeat + '</div>' : '') +

            '<div class="shot-controls-grid">' +
                // SECTION SELECTION (Start / Middle / End / Custom)
                '<div class="control-group">' +
                    '<label>Trim Section:</label>' +
                    '<select onchange="updateShotProp(' + idx + ', \'section\', this.value)">' +
                        '<option value="middle"' + (shot.section === 'middle' ? ' selected' : '') + '>✨ Middle (Highlight)</option>' +
                        '<option value="start"' + (shot.section === 'start' ? ' selected' : '') + '>🎯 First Part (Start)</option>' +
                        '<option value="end"' + (shot.section === 'end' ? ' selected' : '') + '>🏁 Ending (Climax)</option>' +
                        '<option value="custom"' + (shot.section === 'custom' ? ' selected' : '') + '>🛠️ Custom In/Out</option>' +
                    '</select>' +
                '</div>' +

                // AUDIO MODE (Both / Mute / Audio Only)
                '<div class="control-group">' +
                    '<label>Audio Mode:</label>' +
                    '<select onchange="updateShotProp(' + idx + ', \'audioMode\', this.value)">' +
                        '<option value="mute"' + (shot.audioMode === 'mute' ? ' selected' : '') + '>🔇 Mute (Video Only)</option>' +
                        '<option value="both"' + (shot.audioMode === 'both' ? ' selected' : '') + '>🔊 Both Audio+Video</option>' +
                        '<option value="audio_only"' + (shot.audioMode === 'audio_only' ? ' selected' : '') + '>🎙️ Audio Only</option>' +
                    '</select>' +
                '</div>' +

                // KEYFRAME MOTION
                '<div class="control-group">' +
                    '<label>Motion Keyframe:</label>' +
                    '<select onchange="updateShotProp(' + idx + ', \'keyframe\', this.value)">' +
                        '<option value="push_in"' + (shot.keyframe === 'push_in' ? ' selected' : '') + '>🔍 Ken Burns Push</option>' +
                        '<option value="pull_out"' + (shot.keyframe === 'pull_out' ? ' selected' : '') + '>🔎 Wide Pull-Out</option>' +
                        '<option value="none"' + (shot.keyframe === 'none' ? ' selected' : '') + '>⛔ Static</option>' +
                    '</select>' +
                '</div>' +

                // TRANSITION
                '<div class="control-group">' +
                    '<label>Transition In:</label>' +
                    '<select onchange="updateShotProp(' + idx + ', \'transition\', this.value)">' +
                        '<option value="cross_dissolve"' + (shot.transition === 'cross_dissolve' ? ' selected' : '') + '>🌊 Cross Dissolve</option>' +
                        '<option value="whip_pan"' + (shot.transition === 'whip_pan' ? ' selected' : '') + '>⚡ Whip Pan</option>' +
                        '<option value="zoom"' + (shot.transition === 'zoom' ? ' selected' : '') + '>🔍 Zoom In</option>' +
                        '<option value="flash"' + (shot.transition === 'flash' ? ' selected' : '') + '>⚪ White Flash</option>' +
                        '<option value="none"' + (shot.transition === 'none' ? ' selected' : '') + '>✂️ Hard Cut</option>' +
                    '</select>' +
                '</div>' +

                // TEXT TEMPLATE (MOGRT)
                '<div class="control-group" style="grid-column: span 2;">' +
                    '<label>On-Screen Text MOGRT:</label>' +
                    '<select onchange="updateShotProp(' + idx + ', \'mogrt\', this.value)">' +
                        '<option value="none"' + (shot.mogrt === 'none' ? ' selected' : '') + '>None</option>' +
                        '<option value="Real_Estate_Hero_Title"' + (shot.mogrt === 'Real_Estate_Hero_Title' ? ' selected' : '') + '>🏠 Hero Property Title (Delhi Airport)</option>' +
                        '<option value="Real_Estate_Price_Tag"' + (shot.mogrt === 'Real_Estate_Price_Tag' ? ' selected' : '') + '>💰 Luxury Price Tag (₹15 CR)</option>' +
                        '<option value="Real_Estate_Property_Specs"' + (shot.mogrt === 'Real_Estate_Property_Specs' ? ' selected' : '') + '>📋 Specs Lower 3rd (Private Lift / Floor)</option>' +
                        '<option value="Real_Estate_Feature_Callout"' + (shot.mogrt === 'Real_Estate_Feature_Callout' ? ' selected' : '') + '>✨ Feature Callout Card</option>' +
                        '<option value="Just_Listed_Badge"' + (shot.mogrt === 'Just_Listed_Badge' ? ' selected' : '') + '>🔥 Just Listed Ribbon</option>' +
                        '<option value="Real_Estate_Agent_Outro"' + (shot.mogrt === 'Real_Estate_Agent_Outro' ? ' selected' : '') + '>👤 Broker & Agent Outro</option>' +
                    '</select>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function updateShotProp(idx, prop, value) {
    if (storyboardItems[idx]) {
        storyboardItems[idx][prop] = value;
    }
}

function deleteStoryboardItem(idx) {
    storyboardItems.splice(idx, 1);
    renderStoryboardUI();
}

// 4. TIMELINE EXECUTION ENGINE
function executeProfessionalTimeline() {
    if (storyboardItems.length === 0) {
        alert("Please add video clips and set up your storyboard first.");
        return;
    }

    var btn = document.getElementById('btnBuildTimeline');
    if (btn) {
        btn.textContent = "⏳ BUILDING PROFESSIONAL TIMELINE...";
        btn.style.opacity = '0.7';
    }

    logStatus("🚀 Placing cuts, trimming middle/end sections, muting b-roll & animating keyframes...");

    var payload = {
        storyboard: storyboardItems,
        isVertical: (activeRatio === '9:16'),
        pacingSeconds: Number(document.getElementById('pacingSlider').value) || 2.2,
        sequenceName: (activeRatio === '9:16') ? 'AI_RealEstate_Reel_9x16' : 'AI_RealEstate_Tour_16x9',
        details: {
            price: document.getElementById('propPrice').value,
            title: document.getElementById('propTitle').value,
            specs: document.getElementById('propSpecs').value
        }
    };

    var call = '$realEstateHost.buildProfessionalTimeline(' + JSON.stringify(JSON.stringify(payload)) + ')';
    csInterface.evalScript(call, function(res) {
        if (btn) {
            btn.textContent = "⚡ BUILD TIMELINE IN PREMIERE PRO";
            btn.style.opacity = '1';
        }
        try {
            var data = JSON.parse(res);
            if (data.success) {
                logStatus("🎉 " + data.message);
                alert(data.message + "\nSequence: " + data.sequenceName + "\nTotal Cuts: " + data.totalClipsPlaced);
            } else {
                logStatus("⚠️ " + (data.error || data.message));
                // Fallback: Generate XML and launch
                exportAndLaunchXml();
            }
        } catch (err) {
            logStatus("ExtendScript response: " + res);
            exportAndLaunchXml();
        }
    });
}

// 5. XML GENERATION & INSTANT PREMIERE LAUNCH
function exportAndLaunchXml() {
    logStatus("Generating native Premiere XML project with exact trims, keyframes & audio...");
    try {
        if (typeof require !== 'undefined') {
            var pg = require('C:/VideoEditorAI/premiere_generator.js');
            var result = pg.buildAndOpenInPremiere({
                folderPath: document.getElementById('folderInput').value,
                videoFiles: selectedFiles,
                storyboard: storyboardItems,
                aspectRatio: activeRatio,
                pacingSeconds: Number(document.getElementById('pacingSlider').value) || 2.2,
                title: document.getElementById('propTitle').value || 'AI_RealEstate_Edit',
                details: {
                    price: document.getElementById('propPrice').value,
                    title: document.getElementById('propTitle').value,
                    specs: document.getElementById('propSpecs').value
                }
            });

            if (result.success) {
                logStatus("🎉 Generated: " + result.sequenceName + " (" + result.totalCuts + " cuts)");
                // Import XML into active Premiere project
                csInterface.evalScript('$realEstateHost.importXmlSequence(' + JSON.stringify(result.xmlPath.replace(/\\/g, '/')) + ')', function(xmlRes) {
                    logStatus("✅ Sequence loaded into active Premiere Pro timeline!");
                });
            }
        }
    } catch (e) {
        logStatus("XML generator: " + e.message);
    }
}

// UI NAVIGATION & HELPERS
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-pane').forEach(function(p) { p.classList.remove('active'); });

    var targetBtn = document.getElementById('tab-btn-' + tabId);
    var targetPane = document.getElementById('tab-pane-' + tabId);

    if (targetBtn) targetBtn.classList.add('active');
    if (targetPane) targetPane.classList.add('active');
}

function selectRatio(ratio) {
    activeRatio = ratio;
    document.querySelectorAll('.ratio-btn').forEach(function(b) {
        if (b.getAttribute('data-ratio') === ratio) b.classList.add('active');
        else b.classList.remove('active');
    });
    var disp = document.getElementById('ratioDisplay');
    if (disp) disp.textContent = (ratio === '9:16') ? '9:16 Vertical Reel' : '16:9 Landscape 4K';
}

function updatePacingDisplay(val) {
    var d = document.getElementById('pacingVal');
    if (d) d.textContent = val + 's';
}

function setStatus(text, online) {
    var badge = document.getElementById('statusBadge');
    var txt = document.getElementById('statusText');
    if (txt) txt.textContent = text;
    if (badge) {
        if (online) badge.classList.add('online');
        else badge.classList.remove('online');
    }
}

function logStatus(msg) {
    var logEl = document.getElementById('liveLog');
    if (logEl) {
        logEl.textContent = msg;
    }
}

// SETUP DRAG & DROP ON WINDOW
window.addEventListener('DOMContentLoaded', function() {
    var dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer && e.dataTransfer.files) {
                var dropped = [];
                for (var i = 0; i < e.dataTransfer.files.length; i++) {
                    var file = e.dataTransfer.files[i];
                    if (file.path) dropped.push(file.path.replace(/\\/g, '/'));
                }
                if (dropped.length > 0) addFilesToList(dropped);
            }
        });
    }

    // Ping Premiere Pro Host
    setTimeout(function() {
        csInterface.evalScript('$realEstateHost.ping()', function(res) {
            try {
                var d = JSON.parse(res);
                if (d.success) setStatus(d.projectName, true);
                else setStatus('No Project Open', false);
            } catch (e) {
                setStatus('CEP Connected', true);
            }
        });
        // Default scan C:\cllg if exists
        scanLocalFolder('C:\\cllg');
    }, 300);
});
