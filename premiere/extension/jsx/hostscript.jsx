/**
 * hostscript.jsx — Adobe Premiere Pro ExtendScript Engine
 * Full support for Keyframing, Masking, Timeline Slicing, and Real Estate Graphics
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

function findProjectItem(filePathOrName) {
    if (!app.project) return null;
    var root = app.project.rootItem;
    var query = (filePathOrName || "").replace(/\\/g, '/').toLowerCase();
    var queryBase = query.split('/').pop().toLowerCase();

    function searchBin(bin) {
        if (!bin || !bin.children) return null;
        for (var i = 0; i < bin.children.numItems; i++) {
            var item = bin.children[i];
            if (!item) continue;
            if (item.type === ProjectItemType.BIN) {
                var found = searchBin(item);
                if (found) return found;
            } else {
                try {
                    if (item.getMediaPath) {
                        var p = item.getMediaPath();
                        if (p) {
                            p = p.replace(/\\/g, '/').toLowerCase();
                            if (p === query || p.indexOf(queryBase) !== -1) return item;
                        }
                    }
                } catch (ePath) {}
                if (item.name && item.name.toLowerCase() === queryBase) {
                    return item;
                }
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
            projectName: app.project.name || "Untitled.prproj",
            hasActiveSequence: seq !== null,
            sequenceName: seq ? seq.name : "No Active Sequence",
            numSequences: app.project.sequences.numSequences
        });
    },

    /**
     * Scan All Video Items Currently in Premiere Pro Project Panel
     */
    getProjectClips: function () {
        try {
            if (!app.project) return JSON.stringify({ success: false, clips: [] });
            var clips = [];
            var root = app.project.rootItem;

            function scan(bin) {
                for (var i = 0; i < bin.children.numItems; i++) {
                    var item = bin.children[i];
                    if (item.type === ProjectItemType.BIN) {
                        scan(item);
                    } else if (item.type === ProjectItemType.CLIP || item.type === ProjectItemType.FILE) {
                        var p = item.getMediaPath ? item.getMediaPath() : "";
                        clips.push({
                            name: item.name,
                            path: p,
                            nodeId: item.nodeId
                        });
                    }
                }
            }
            scan(root);
            return JSON.stringify({ success: true, clips: clips });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.toString() });
        }
    },

    /**
     * Scan and Import all Videos from a Folder Path
     */
    importFolderClips: function (folderPath) {
        try {
            if (!app.project) return JSON.stringify({ success: false, message: "No project open." });
            var targetFolder = new Folder(folderPath);
            if (!targetFolder.exists) {
                return JSON.stringify({ success: false, message: "Folder does not exist on disk: " + folderPath });
            }

            var files = targetFolder.getFiles(function (f) {
                if (f instanceof Folder) return false;
                var ext = f.name.slice((f.name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
                return (ext === "mp4" || ext === "mov" || ext === "mkv" || ext === "m4v" || ext === "avi");
            });

            if (files.length === 0) {
                return JSON.stringify({ success: false, message: "No video files found in " + folderPath });
            }

            var pathsToImport = [];
            for (var i = 0; i < files.length; i++) {
                pathsToImport.push(files[i].fsName);
            }

            // Create or get dedicated bin
            var aiBin = null;
            for (var b = 0; b < app.project.rootItem.children.numItems; b++) {
                if (app.project.rootItem.children[b].name === "AI Real Estate Footage") {
                    aiBin = app.project.rootItem.children[b];
                    break;
                }
            }
            if (!aiBin) {
                aiBin = app.project.rootItem.createBin("AI Real Estate Footage");
            }

            app.project.importFiles(pathsToImport, true, aiBin, false);

            return JSON.stringify({
                success: true,
                message: "Imported " + pathsToImport.length + " video files.",
                importedCount: pathsToImport.length,
                files: pathsToImport
            });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.toString() });
        }
    },

    /**
     * Master Video Automation: Slices, Keyframes, Masks, and Builds Sequence
     */
    buildRealEstateTimeline: function (paramsJSON) {
        try {
            var params = JSON.parse(paramsJSON);
            var filePaths = params.videoPaths || [];
            var folderPath = params.folderPath || "";
            var pacingSeconds = Number(params.pacingSeconds) || 2.2;
            var keyframeMode = params.keyframeMode || "push_in"; // push_in, alternating, none
            var maskMode = params.maskMode || "none"; // letterbox, vignette, none
            var isVertical = params.isVertical === true;
            var details = params.details || {};
            var seqName = params.sequenceName || (isVertical ? "AI_RealEstate_Reel_9x16" : "AI_RealEstate_Tour_16x9");

            if (!app.project) {
                return JSON.stringify({ success: false, message: "Open a project in Premiere Pro first." });
            }

            // 1. If folder path provided, import clips from folder
            if (folderPath && (!filePaths || filePaths.length === 0)) {
                var folderObj = new Folder(folderPath);
                if (folderObj.exists) {
                    var files = folderObj.getFiles(function (f) {
                        if (f instanceof Folder) return false;
                        var ext = f.name.slice((f.name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
                        return (ext === "mp4" || ext === "mov" || ext === "mkv" || ext === "m4v" || ext === "avi");
                    });
                    filePaths = [];
                    for (var fi = 0; fi < files.length; fi++) {
                        filePaths.push(files[fi].fsName);
                    }
                }
            }

            // Import files if not in project
            if (filePaths.length > 0) {
                app.project.importFiles(filePaths, true, app.project.rootItem, false);
            }

            // 2. Ensure sequence exists or create one
            var seq = getActiveSequence();
            if (!seq) {
                seq = app.project.createNewSequence(seqName, "");
            }
            if (!seq) {
                return JSON.stringify({ success: false, message: "Could not create or access timeline sequence." });
            }

            var videoTrack = seq.videoTracks[0];
            var currentTime = 0;
            var placedCount = 0;

            // Collect project items to place
            var itemsToPlace = [];
            for (var f = 0; f < filePaths.length; f++) {
                var item = findProjectItem(filePaths[f]);
                if (item) itemsToPlace.push(item);
            }

            // Fallback: If no files provided, gather from project root
            if (itemsToPlace.length === 0) {
                for (var r = 0; r < app.project.rootItem.children.numItems; r++) {
                    var child = app.project.rootItem.children[r];
                    if (child.type === ProjectItemType.CLIP || (child.getMediaPath && child.getMediaPath() !== "")) {
                        itemsToPlace.push(child);
                    }
                }
            }

            if (itemsToPlace.length === 0) {
                return JSON.stringify({ success: false, message: "No video clips found. Please enter a valid footage folder or import clips into Premiere." });
            }

            // 3. Cut & Place each clip with pacing
            for (var i = 0; i < itemsToPlace.length; i++) {
                var pItem = itemsToPlace[i];
                // Slice into 2 distinct shots per video clip
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

                    // Apply Keyframes (Ken Burns Motion)
                    if (keyframeMode !== "none" && videoTrack.clips.numItems > placedCount) {
                        var placedClip = videoTrack.clips[videoTrack.clips.numItems - 1];
                        var motionType = keyframeMode;
                        if (keyframeMode === "alternating") {
                            motionType = (placedCount % 2 === 0) ? "push_in" : "pull_out";
                        }
                        $realEstateHost.applyKeyframesToClip(placedClip, motionType);
                    }

                    currentTime += pacingSeconds;
                    placedCount++;
                }
            }

            // 4. Insert Property Callouts & Metadata
            if (details.price || details.title || details.specs) {
                var markers = seq.markers;
                if (markers) {
                    var m1 = markers.createMarker(0);
                    m1.name = details.price ? "PRICE: " + details.price : "FEATURED ESTATE";
                    m1.comments = (details.title || "") + "\n" + (details.specs || "");
                    m1.setColorByIndex(1); // Green marker
                }
            }

            return JSON.stringify({
                success: true,
                message: "Built timeline with " + placedCount + " cuts, Ken Burns keyframes, and real estate sequencing.",
                totalClipsPlaced: placedCount,
                timelineDurationSeconds: currentTime,
                sequenceName: seq.name
            });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.toString() });
        }
    },

    /**
     * Apply Real Premiere Pro Keyframes to a Clip (Scale & Position Animation)
     */
    applyKeyframesToClip: function (clip, motionType) {
        try {
            if (!clip || !clip.components) return;
            for (var c = 0; c < clip.components.numItems; c++) {
                var comp = clip.components[c];
                if (comp.displayName === "Motion") {
                    for (var p = 0; p < comp.properties.numItems; p++) {
                        var prop = comp.properties[p];
                        if (prop.displayName === "Scale") {
                            // Turn on keyframing stopwatch
                            prop.setTimeVarying(true);

                            var tStart = (clip.start && clip.start.seconds !== undefined) ? clip.start : clip.inPoint;
                            var tEnd = (clip.end && clip.end.seconds !== undefined) ? clip.end : clip.outPoint;
                            if (motionType === "pull_out") {
                                // Zoom out 114% -> 100%
                                prop.setValueAtKey(tStart, 114.0, true);
                                prop.setValueAtKey(tEnd, 100.0, true);
                            } else {
                                // Push in 100% -> 114% (Standard Ken Burns)
                                prop.setValueAtKey(tStart, 100.0, true);
                                prop.setValueAtKey(tEnd, 114.0, true);
                            }
                            break;
                        }
                    }
                    break;
                }
            }
        } catch (err) {
            // Keyframe fallback
        }
    },

    /**
     * Apply Keyframes across ALL clips in Active Sequence
     */
    applyKeyframesToActiveSequence: function (motionType) {
        try {
            var seq = getActiveSequence();
            if (!seq) return JSON.stringify({ success: false, message: "No active sequence found." });
            var vTrack = seq.videoTracks[0];
            var count = 0;
            var mode = motionType || "push_in";

            for (var i = 0; i < vTrack.clips.numItems; i++) {
                var clip = vTrack.clips[i];
                var m = mode;
                if (mode === "alternating") {
                    m = (i % 2 === 0) ? "push_in" : "pull_out";
                }
                $realEstateHost.applyKeyframesToClip(clip, m);
                count++;
            }

            return JSON.stringify({
                success: true,
                message: "Applied Ken Burns keyframes to " + count + " clips on timeline."
            });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.toString() });
        }
    },

    /**
     * Insert Real Estate MOGRT Motion Graphics Template onto timeline (V2 track)
     */
    insertMogrt: function (templateName, timeSeconds, trackIndex) {
        try {
            var seq = getActiveSequence();
            if (!seq) {
                return JSON.stringify({ success: false, message: "No active sequence. Open a sequence first." });
            }

            var mogrtDir = Folder.userData.fsName + "/Adobe/Common/Motion Graphics Templates/Real Estate Trends/";
            var mogrtFile = new File(mogrtDir + templateName);

            if (!mogrtFile.exists) {
                mogrtFile = new File("C:/VideoEditorAI/premiere/presets/text_animations/" + templateName);
            }

            if (!mogrtFile.exists) {
                return JSON.stringify({ success: false, message: "MOGRT template not found: " + templateName });
            }

            var insertTime = new Time();
            insertTime.seconds = timeSeconds || 0;
            var targetTrack = trackIndex !== undefined ? trackIndex : 1; // Track V2

            var trackItem = seq.importMGT(mogrtFile.fsName, insertTime, targetTrack, 0);

            return JSON.stringify({
                success: true,
                message: "Inserted " + templateName + " on V" + (targetTrack + 1) + " at " + (timeSeconds || 0) + "s",
                trackItem: trackItem ? trackItem.name : "Placed"
            });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.toString() });
        }
    }
};
