var csInterface = new CSInterface();
var logBox = document.getElementById('logBox');
var statusPill = document.getElementById('statusPill');

function log(msg) {
    if (!logBox) return;
    logBox.textContent += '\n' + msg;
    logBox.scrollTop = logBox.scrollHeight;
}

function checkHostConnection() {
    csInterface.evalScript('$realEstateHost.ping()', function (result) {
        try {
            var data = JSON.parse(result);
            if (data.success) {
                statusPill.textContent = 'CONNECTED: ' + data.projectName;
                statusPill.className = 'status-pill online';
                log('✓ Connected to Premiere Pro Project: ' + data.projectName);
            } else {
                statusPill.textContent = 'OFFLINE: Open a Project';
                statusPill.className = 'status-pill';
                log('Notice: ' + data.message);
            }
        } catch (e) {
            statusPill.textContent = 'CEP Ready';
            log('EvalScript returned: ' + result);
        }
    });
}

function setPreset(type) {
    var promptEl = document.getElementById('aiPrompt');
    var ratioEl = document.getElementById('aspectRatio');
    if (type === 'reel') {
        ratioEl.value = 'reel';
        promptEl.value = 'Fast-paced vertical luxury real estate reel: 2.0s cuts, Ken Burns slow zoom, Warm Golden Hour grade, high-energy hook';
        log('Preset Loaded: 9:16 Viral Real Estate Reel');
    } else if (type === 'luxury') {
        ratioEl.value = 'landscape';
        promptEl.value = 'Cinematic 4K luxury estate tour: 3.5s smooth cuts, slow push-in, Clean Interior grade, elegant aesthetic';
        log('Preset Loaded: 16:9 4K Luxury Tour');
    } else if (type === 'modern') {
        ratioEl.value = 'landscape';
        promptEl.value = 'Minimalist modern architectural tour: 3.0s pacing, deep black contrast, high dynamic range';
        log('Preset Loaded: Modern Minimalist');
    }
}

// Button Auto Cut
document.getElementById('btnAutoCut').addEventListener('click', function () {
    var rawPaths = document.getElementById('videoPaths').value;
    var paths = rawPaths.split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean);
    var isVertical = document.getElementById('aspectRatio').value === 'reel';
    var pacing = isVertical ? 2.0 : 3.0;

    log('▶ Building timeline with ' + paths.length + ' video assets...');

    var params = {
        videoPaths: paths,
        pacingSeconds: pacing,
        addKenBurns: true,
        sequenceName: isVertical ? 'RealEstate_Reel_9x16' : 'RealEstate_Tour_16x9'
    };

    var scriptCall = '$realEstateHost.buildRealEstateTimeline(' + JSON.stringify(JSON.stringify(params)) + ')';
    csInterface.evalScript(scriptCall, function (result) {
        try {
            var res = JSON.parse(result);
            if (res.success) {
                log('🎉 SUCCESS: ' + res.message);
                log('Total Cuts Placed: ' + res.totalClipsPlaced);
                log('Duration: ' + res.timelineDurationSeconds + 's');
            } else {
                log('❌ Error: ' + (res.error || res.message));
            }
        } catch (e) {
            log('Result: ' + result);
        }
    });
});

// Button Add Callout
document.getElementById('btnAddCallout').addEventListener('click', function () {
    var price = document.getElementById('propPrice').value;
    var specs = document.getElementById('propSpecs').value;
    var address = document.getElementById('propAddress').value;

    log('Adding property badges & callouts to timeline...');

    var scriptCall = '$realEstateHost.addPropertyCallout(' +
        JSON.stringify(price) + ', ' +
        JSON.stringify(specs) + ', ' +
        JSON.stringify(address) + ')';

    csInterface.evalScript(scriptCall, function (result) {
        try {
            var res = JSON.parse(result);
            log(res.message);
        } catch (e) {
            log('Result: ' + result);
        }
    });
});

function insertTemplate(templateName, timeSec) {
    log('Inserting ' + templateName + ' at ' + timeSec + 's on V2 track...');
    var call = '$realEstateHost.insertMogrt(' + JSON.stringify(templateName) + ', ' + timeSec + ', 1)';
    csInterface.evalScript(call, function(res) {
        try {
            var data = JSON.parse(res);
            if (data.success) {
                log('✓ ' + data.message);
            } else {
                log('Notice: ' + (data.error || data.message));
            }
        } catch (e) {
            log('Result: ' + res);
        }
    });
}

// Run connection check on load
window.addEventListener('load', function () {
    setTimeout(checkHostConnection, 500);
});
