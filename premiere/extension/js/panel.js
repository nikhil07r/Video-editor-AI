var csInterface = new CSInterface();
var currentScannedFiles = [];
var activeRatio = '9:16';

function setStatus(text, isOnline) {
    var badge = document.getElementById('statusBadge');
    var txt = document.getElementById('statusText');
    if (txt) txt.textContent = text;
    if (badge) {
        if (isOnline) badge.classList.add('online');
        else badge.classList.remove('online');
    }
}

function logStatus(msg) {
    var logEl = document.getElementById('statusLog');
    if (logEl) {
        logEl.textContent = msg;
        logEl.style.color = '#00F0FF';
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-pane').forEach(function(pane) {
        pane.classList.remove('active');
    });

    var activeBtn = document.querySelector('.tab-btn[onclick*="' + tabId + '"]');
    if (activeBtn) activeBtn.classList.add('active');

    var activePane = document.getElementById('tab-' + tabId);
    if (activePane) activePane.classList.add('active');
}

function selectRatio(ratio) {
    activeRatio = ratio;
    document.querySelectorAll('.ratio-card').forEach(function(card) {
        var input = card.querySelector('input');
        if (input && input.value === ratio) {
            card.classList.add('active');
            input.checked = true;
        } else {
            card.classList.remove('active');
        }
    });

    var slider = document.getElementById('pacingSlider');
    if (ratio === '9:16') {
        slider.value = 2.0;
        updatePacingDisplay(2.0);
    } else {
        slider.value = 3.5;
        updatePacingDisplay(3.5);
    }
}

function updatePacingDisplay(val) {
    var disp = document.getElementById('pacingDisplay');
    var helper = document.getElementById('pacingHelper');
    if (disp) disp.textContent = val + 's';
    if (helper) {
        if (Number(val) <= 2.2) {
            helper.textContent = '⚡ Fast-paced viral hook rhythm (Reels / TikTok)';
        } else {
            helper.textContent = '🏰 Elegant slow cinematic pacing (4K Tour / YouTube)';
        }
    }
}

function setFolder(folderPath) {
    var input = document.getElementById('footageFolderInput');
    if (input) {
        input.value = folderPath;
        scanFootageFolder();
    }
}

function scanFootageFolder() {
    var input = document.getElementById('footageFolderInput');
    var folderPath = input ? input.value.trim() : '';

    if (!folderPath) {
        logStatus('Please enter a folder path.');
        return;
    }

    logStatus('Scanning folder: ' + folderPath + '...');
    currentScannedFiles = [];

    // 1. Try Node.js fs scan if available in CEP
    var scanned = [];
    try {
        if (typeof require !== 'undefined') {
            var fs = require('fs');
            var path = require('path');
            if (fs.existsSync(folderPath)) {
                var files = fs.readdirSync(folderPath);
                var videoExts = ['.mp4', '.mov', '.mkv', '.m4v', '.avi'];
                files.forEach(function(f) {
                    var ext = path.extname(f).toLowerCase();
                    if (videoExts.indexOf(ext) !== -1) {
                        scanned.push(path.join(folderPath, f).replace(/\\/g, '/'));
                    }
                });
            }
        }
    } catch (e) {
        console.log('Node scan fallback:', e.message);
    }

    if (scanned.length > 0) {
        updateScannedUI(scanned);
        logStatus('✅ Found ' + scanned.length + ' video files ready.');
        return;
    }

    // 2. Fallback to ExtendScript folder scan
    var call = '$realEstateHost.importFolderClips(' + JSON.stringify(folderPath) + ')';
    csInterface.evalScript(call, function(res) {
        try {
            var data = JSON.parse(res);
            if (data.success && data.files) {
                updateScannedUI(data.files);
                logStatus('✅ ' + data.message);
            } else {
                logStatus(data.message || 'No video files found.');
                updateScannedUI([]);
            }
        } catch (err) {
            logStatus('Scan error: ' + res);
        }
    });
}

function updateScannedUI(files) {
    currentScannedFiles = files;
    var statusText = document.getElementById('scanStatusText');
    var chipsList = document.getElementById('clipChipsList');

    if (!statusText || !chipsList) return;

    if (files.length === 0) {
        statusText.textContent = 'No video clips detected yet.';
        statusText.style.color = '#F59E0B';
        chipsList.innerHTML = '<span style="color:#777; font-size:10px;">Check folder path or choose another directory.</span>';
    } else {
        statusText.textContent = '✅ ' + files.length + ' video clips ready to edit:';
        statusText.style.color = '#10B981';
        chipsList.innerHTML = files.map(function(f) {
            var name = f.split('/').pop().split('\\').pop();
            return '<span class="clip-chip">' + name + '</span>';
        }).join('');
    }
}

function useProjectClips() {
    logStatus('Reading clips from Premiere Pro Project Panel...');
    csInterface.evalScript('$realEstateHost.getProjectClips()', function(res) {
        try {
            var data = JSON.parse(res);
            if (data.success && data.clips && data.clips.length > 0) {
                var paths = data.clips.map(function(c) { return c.path || c.name; });
                updateScannedUI(paths);
                logStatus('✅ Loaded ' + paths.length + ' clips from Premiere Project Panel.');
            } else {
                logStatus('No video clips found in active Premiere project bins.');
            }
        } catch (e) {
            logStatus('Could not read project clips: ' + res);
        }
    });
}

function executeMasterAutoEdit() {
    var btn = document.getElementById('btnMasterAutoEdit');
    btn.style.opacity = '0.7';
    logStatus('⏳ Slicing clips, applying keyframes & building timeline...');

    var folder = document.getElementById('footageFolderInput').value.trim();
    var price = document.getElementById('propPrice').value.trim();
    var title = document.getElementById('propTitle').value.trim();
    var specs = document.getElementById('propSpecs').value.trim();
    var agent = document.getElementById('propAgent').value.trim();

    var pacing = Number(document.getElementById('pacingSlider').value) || 2.0;
    var keyframeMode = document.getElementById('keyframeStyle').value;
    var maskMode = document.getElementById('maskStyle').value;
    var isVertical = (activeRatio === '9:16');

    var payload = {
        folderPath: folder,
        videoPaths: currentScannedFiles,
        pacingSeconds: pacing,
        keyframeMode: keyframeMode,
        maskMode: maskMode,
        isVertical: isVertical,
        sequenceName: isVertical ? 'AI_RealEstate_Reel_9x16' : 'AI_RealEstate_Tour_16x9',
        details: {
            price: price,
            title: title,
            specs: specs,
            agent: agent
        }
    };

    var call = '$realEstateHost.buildRealEstateTimeline(' + JSON.stringify(JSON.stringify(payload)) + ')';
    csInterface.evalScript(call, function(res) {
        btn.style.opacity = '1';
        try {
            var data = JSON.parse(res);
            if (data.success) {
                logStatus('🎉 ' + data.message);
                alert(data.message + '\nTotal Cuts: ' + data.totalClipsPlaced + '\nSequence: ' + data.sequenceName);
            } else {
                logStatus('❌ ' + (data.error || data.message));
                alert('Notice: ' + (data.error || data.message));
            }
        } catch (err) {
            logStatus('Response: ' + res);
        }
    });
}

function insertTemplate(templateName, timeSec) {
    logStatus('Inserting ' + templateName + ' at ' + timeSec + 's on V2 track...');
    var call = '$realEstateHost.insertMogrt(' + JSON.stringify(templateName) + ', ' + timeSec + ', 1)';
    csInterface.evalScript(call, function(res) {
        try {
            var data = JSON.parse(res);
            logStatus(data.message || 'MOGRT placed.');
        } catch (e) {
            logStatus('Result: ' + res);
        }
    });
}

function checkHostConnection() {
    csInterface.evalScript('$realEstateHost.ping()', function(res) {
        try {
            var data = JSON.parse(res);
            if (data.success) {
                setStatus(data.projectName, true);
            } else {
                setStatus('No Project Open', false);
            }
        } catch (e) {
            setStatus('CEP Connected', true);
        }
    });
}

// Initial Auto-Scan on Load
window.addEventListener('load', function() {
    setTimeout(function() {
        checkHostConnection();
        scanFootageFolder();
    }, 400);
});
