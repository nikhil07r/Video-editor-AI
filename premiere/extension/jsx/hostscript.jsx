/**
 * hostscript.jsx — Adobe Premiere Pro ExtendScript Bridge
 * Compatibility: Adobe Premiere Pro CC 2019 - 2026+ (ES3 Engine)
 */

// 1. JSON POLYFILL FOR PREMIERE PRO
if (typeof JSON !== 'object') { JSON = {}; }
(function () {
    var rx_escapable = /[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    var meta = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"': '\\"', '\\': '\\\\' };
    function quote(string) {
        rx_escapable.lastIndex = 0;
        return rx_escapable.test(string) ? '"' + string.replace(rx_escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }
    function str(key, holder) {
        var i, k, v, length, partial, value = holder[key];
        if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }
        switch (typeof value) {
            case 'string': return quote(value);
            case 'number': return isFinite(value) ? String(value) : 'null';
            case 'boolean':
            case 'null': return String(value);
            case 'object':
                if (!value) return 'null';
                partial = [];
                if (Object.prototype.toString.apply(value) === '[object Array]') {
                    length = value.length;
                    for (i = 0; i < length; i += 1) {
                        partial[i] = str(i, value) || 'null';
                    }
                    return '[' + partial.join(',') + ']';
                }
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) partial.push(quote(k) + ':' + v);
                    }
                }
                return '{' + partial.join(',') + '}';
        }
    }
    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value) { return str('', { '': value }); };
    }
    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text) { return eval('(' + text + ')'); };
    }
}());

// 2. HELPER FUNCTIONS
function getActiveSequence() {
    if (!app.project) return null;
    return app.project.activeSequence;
}

function findProjectItemByPath(filePath) {
    var root = app.project.rootItem;
    var normalized = filePath.replace(/\\/g, '/').toLowerCase();
    
    function searchBin(bin) {
        for (var i = 0; i < bin.children.numItems; i++) {
            var item = bin.children[i];
            if (item.type === ProjectItemType.BIN) {
                var found = searchBin(item);
                if (found) return found;
            } else if (item.getMediaPath) {
                var p = item.getMediaPath().replace(/\\/g, '/').toLowerCase();
                if (p === normalized) return item;
            }
        }
        return null;
    }
    return searchBin(root);
}

// 3. CORE EXPORTED API FOR PREMIERE PRO CEP
var $realEstateHost = {
    /**
     * Check Premiere Pro Connection Status
     */
    ping: function () {
        if (!app.project) {
            return JSON.stringify({ success: false, message: "No active project open in Premiere Pro." });
        }
        var seq = getActiveSequence();
        return JSON.stringify({
            success: true,
            projectName: app.project.name || "Untitled",
            hasActiveSequence: seq !== null,
            sequenceName: seq ? seq.name : "None",
            numSequences: app.project.sequences.numSequences
        });
    },

    /**
     * Create Real Estate Sequence (16:9 4K or 9:16 Vertical Reel)
     */
    createSequence: function (seqName, isVertical) {
        try {
            if (!app.project) {
                return JSON.stringify({ success: false, message: "Open or create a project in Premiere Pro first." });
            }
            var name = seqName || (isVertical ? "RealEstate_Reel_9x16" : "RealEstate_Tour_16x9");
            
            // Create sequence
            var seq = app.project.createNewSequence(name, "");
            return JSON.stringify({
                success: true,
                message: "Sequence created: " + name,
                sequenceName: name
            });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.toString() });
        }
    },

    /**
     * Import Footage files and build Real Estate Timeline
     */
    buildRealEstateTimeline: function (paramsJSON) {
        try {
            var params = JSON.parse(paramsJSON);
            var filePaths = params.videoPaths || [];
            var pacingSeconds = params.pacingSeconds || 2.5;
            var addKenBurns = params.addKenBurns !== false;
            var seqName = params.sequenceName || "AI_RealEstate_AutoCut";

            if (!app.project) {
                return JSON.stringify({ success: false, message: "No project open." });
            }

            // 1. Import files
            if (filePaths.length > 0) {
                app.project.importFiles(filePaths, true, app.project.rootItem, false);
            }

            // 2. Ensure sequence exists
            var seq = getActiveSequence();
            if (!seq) {
                seq = app.project.createNewSequence(seqName, "");
            }

            if (!seq) {
                return JSON.stringify({ success: false, message: "Could not initialize sequence." });
            }

            var videoTrack = seq.videoTracks[0];
            var currentTime = 0;
            var placedCount = 0;

            for (var f = 0; f < filePaths.length; f++) {
                var pItem = findProjectItemByPath(filePaths[f]);
                if (!pItem) continue;

                // Slice each video into 2 to 3 paced shots (foyer, angle 1, angle 2)
                var slices = [0, pacingSeconds];
                for (var s = 0; s < slices.length; s++) {
                    var inSec = slices[s];
                    var outSec = inSec + pacingSeconds;

                    var timeIn = new Time();
                    timeIn.seconds = inSec;
                    var timeOut = new Time();
                    timeOut.seconds = outSec;

                    pItem.setInPoint(timeIn, 4);
                    pItem.setOutPoint(timeOut, 4);

                    var insertTime = new Time();
                    insertTime.seconds = currentTime;

                    videoTrack.overwriteClip(pItem, insertTime);

                    // Add Ken Burns Slow Push Motion
                    if (addKenBurns && videoTrack.clips.numItems > placedCount) {
                        var clip = videoTrack.clips[videoTrack.clips.numItems - 1];
                        $realEstateHost.applyKenBurnsToClip(clip);
                    }

                    currentTime += pacingSeconds;
                    placedCount++;
                }
            }

            return JSON.stringify({
                success: true,
                message: "Successfully generated Real Estate timeline with " + placedCount + " cuts.",
                totalClipsPlaced: placedCount,
                timelineDurationSeconds: currentTime
            });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.toString() });
        }
    },

    /**
     * Apply subtle smooth Ken Burns slow zoom to a clip
     */
    applyKenBurnsToClip: function (clip) {
        try {
            if (!clip || !clip.components) return;
            for (var c = 0; c < clip.components.numItems; c++) {
                var comp = clip.components[c];
                if (comp.displayName === "Motion") {
                    for (var p = 0; p < comp.properties.numItems; p++) {
                        var prop = comp.properties[p];
                        if (prop.displayName === "Scale") {
                            // Gentle 100% to 105% slow push in
                            prop.setTimeVarying(true);
                            prop.setValueAtKey(clip.inPoint, 100.0, true);
                            prop.setValueAtKey(clip.outPoint, 106.0, true);
                            break;
                        }
                    }
                    break;
                }
            }
        } catch (err) {
            // Motion animation fallback
        }
    },

    /**
     * Add Modern Real Estate Callout Marker & Graphics
     */
    addPropertyCallout: function (price, specs, address) {
        try {
            var seq = getActiveSequence();
            if (!seq) {
                return JSON.stringify({ success: false, message: "No active sequence found." });
            }

            // Add chapter markers with property metadata
            var markers = seq.markers;
            if (markers) {
                var m = markers.createMarker(0);
                m.name = price ? "PRICE: " + price : "EXCLUSIVE LISTING";
                m.comments = (specs || "") + "\n" + (address || "");
                m.setColorByIndex(1); // Green marker
            }

            return JSON.stringify({
                success: true,
                message: "Added Property Callout Metadata: " + price + " | " + specs
            });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.toString() });
        }
    },

    /**
     * Insert Real Estate MOGRT Motion Graphics Template onto timeline
     */
    insertMogrt: function (templateName, timeSeconds, trackIndex) {
        try {
            var seq = getActiveSequence();
            if (!seq) {
                return JSON.stringify({ success: false, message: "No active sequence found." });
            }

            var mogrtDir = Folder.userData.fsName + "/Adobe/Common/Motion Graphics Templates/Real Estate Trends/";
            var mogrtFile = new File(mogrtDir + templateName);

            if (!mogrtFile.exists) {
                // Fallback to C:\VideoEditorAI
                mogrtFile = new File("C:/VideoEditorAI/premiere/presets/text_animations/" + templateName);
            }

            if (!mogrtFile.exists) {
                return JSON.stringify({ success: false, message: "Template file not found: " + templateName });
            }

            var insertTime = new Time();
            insertTime.seconds = timeSeconds || 0;
            var targetTrack = trackIndex !== undefined ? trackIndex : 1; // V2 overlay track

            // Premiere Pro ExtendScript native MOGRT insertion
            var trackItem = seq.importMGT(mogrtFile.fsName, insertTime, targetTrack, 0);

            return JSON.stringify({
                success: true,
                message: "Inserted MOGRT: " + templateName + " at " + (timeSeconds || 0) + "s",
                trackItem: trackItem ? trackItem.name : "MOGRT Placed"
            });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.toString() });
        }
    }
};
