const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class PremiereGenerator {
    /**
     * Scan video files from a directory
     */
    scanFolder(folderPath) {
        if (!fs.existsSync(folderPath)) return [];
        const videoExts = ['.mp4', '.mov', '.mkv', '.m4v', '.avi'];
        try {
            return fs.readdirSync(folderPath)
                .filter(f => videoExts.includes(path.extname(f).toLowerCase()))
                .map(f => path.join(folderPath, f).replace(/\\/g, '/'));
        } catch (e) {
            console.error('Error scanning folder:', e);
            return [];
        }
    }

    /**
     * Parse natural language script/prompt into storyboard shot definitions
     */
    parseScriptToStoryboard(scriptText, videoFiles = [], options = {}) {
        const lines = (scriptText || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
        const defaultPacing = Number(options.pacingSeconds) || 2.2;
        const totalClips = videoFiles.length > 0 ? videoFiles.length : 4;
        const storyboard = [];

        // If no script provided, generate intelligent default storyboard from clips
        if (lines.length === 0) {
            videoFiles.forEach((file, idx) => {
                const isFirst = (idx === 0);
                const isLast = (idx === videoFiles.length - 1);
                let section = 'middle';
                let mogrt = 'none';
                let keyframe = (idx % 2 === 0) ? 'push_in' : 'pull_out';
                let transition = (idx === 0) ? 'none' : 'cross_dissolve';
                let audioMode = 'mute'; // Real estate default: mute b-roll camera mic

                if (isFirst) {
                    section = 'start';
                    mogrt = 'Real_Estate_Hero_Title';
                    keyframe = 'push_in';
                    transition = 'none';
                } else if (idx === 1 && options.details && options.details.price) {
                    section = 'middle';
                    mogrt = 'Real_Estate_Price_Tag';
                } else if (idx === 2 && options.details && options.details.specs) {
                    section = 'middle';
                    mogrt = 'Real_Estate_Property_Specs';
                } else if (isLast) {
                    section = 'end';
                    mogrt = 'Real_Estate_Agent_Outro';
                    keyframe = 'pull_out';
                }

                storyboard.push({
                    shotIndex: idx + 1,
                    videoPath: file,
                    fileName: path.basename(file),
                    pacingSeconds: defaultPacing,
                    section: section, // start, middle, end, two_cuts, custom
                    audioMode: audioMode, // both, mute, audio_only
                    keyframe: keyframe, // push_in, pull_out, none
                    transition: transition, // none, cross_dissolve, whip_pan, zoom, flash
                    mogrt: mogrt,
                    sfx: isFirst ? 'cinematic_whoosh.wav' : (idx === 1 ? 'cinematic_sub_boom.wav' : 'none'),
                    customIn: 0,
                    customOut: defaultPacing
                });
            });
            return storyboard;
        }

        // Script-driven parsing
        lines.forEach((line, idx) => {
            const lower = line.toLowerCase();
            const file = videoFiles[idx % videoFiles.length] || `video_${idx + 1}.mp4`;

            // Detect section trimming
            let section = 'middle'; // Default to smoothest part
            if (lower.includes('start') || lower.includes('hook') || lower.includes('intro') || lower.includes('beginning')) {
                section = 'start';
            } else if (lower.includes('end') || lower.includes('last') || lower.includes('outro') || lower.includes('closing')) {
                section = 'end';
            } else if (lower.includes('2 cuts') || lower.includes('two cuts') || lower.includes('double cut')) {
                section = 'two_cuts';
            }

            // Detect audio mode
            let audioMode = 'mute';
            if (lower.includes('audio only') || lower.includes('voiceover') || lower.includes('narration') || lower.includes('sound only')) {
                audioMode = 'audio_only';
            } else if (lower.includes('original sound') || lower.includes('keep audio') || lower.includes('unmute') || lower.includes('mic')) {
                audioMode = 'both';
            }

            // Detect keyframe motion
            let keyframe = (idx % 2 === 0) ? 'push_in' : 'pull_out';
            if (lower.includes('push') || lower.includes('zoom in')) keyframe = 'push_in';
            else if (lower.includes('pull') || lower.includes('zoom out') || lower.includes('reveal')) keyframe = 'pull_out';
            else if (lower.includes('static') || lower.includes('no zoom')) keyframe = 'none';

            // Detect transition
            let transition = (idx === 0) ? 'none' : 'cross_dissolve';
            if (lower.includes('whoosh') || lower.includes('whip') || lower.includes('pan')) transition = 'whip_pan';
            else if (lower.includes('zoom transition')) transition = 'zoom';
            else if (lower.includes('flash') || lower.includes('dip to white')) transition = 'flash';
            else if (lower.includes('cut') || lower.includes('hard cut')) transition = 'none';

            // Detect MOGRT template
            let mogrt = 'none';
            if (lower.includes('price') || lower.includes('₹') || lower.includes('cr') || lower.includes('crore') || lower.includes('cost')) {
                mogrt = 'Real_Estate_Price_Tag';
            } else if (lower.includes('spec') || lower.includes('bed') || lower.includes('bath') || lower.includes('lift') || lower.includes('floor') || lower.includes('sqft')) {
                mogrt = 'Real_Estate_Property_Specs';
            } else if (lower.includes('title') || lower.includes('airport') || lower.includes('smart city') || lower.includes('welcome') || lower.includes('facade')) {
                mogrt = 'Real_Estate_Hero_Title';
            } else if (lower.includes('outro') || lower.includes('agent') || lower.includes('contact') || lower.includes('call') || lower.includes('broker')) {
                mogrt = 'Real_Estate_Agent_Outro';
            } else if (lower.includes('feature') || lower.includes('amenity') || lower.includes('pool') || lower.includes('luxury')) {
                mogrt = 'Real_Estate_Feature_Callout';
            }

            // Detect SFX
            let sfx = 'none';
            if (transition === 'whip_pan' || lower.includes('whoosh')) sfx = 'cinematic_whoosh.wav';
            else if (mogrt === 'Real_Estate_Price_Tag' || lower.includes('boom') || lower.includes('impact')) sfx = 'cinematic_sub_boom.wav';
            else if (lower.includes('bell') || lower.includes('chime')) sfx = 'lux_bell_chime.wav';

            storyboard.push({
                shotIndex: idx + 1,
                videoPath: file,
                fileName: path.basename(file),
                pacingSeconds: defaultPacing,
                section: section,
                audioMode: audioMode,
                keyframe: keyframe,
                transition: transition,
                mogrt: mogrt,
                sfx: sfx,
                scriptBeat: line,
                customIn: 0,
                customOut: defaultPacing
            });
        });

        return storyboard;
    }

    /**
     * Generate an FCP XML sequence file natively readable by Premiere Pro
     * Supports: In/Out trims, Middle/End/Start sections, Scale keyframes, Audio muting/extracting,
     * SFX tracks, and Transitions.
     */
    generateSequenceXml(options) {
        const {
            sequenceName = 'AI_RealEstate_Professional_Edit',
            width = 1080,
            height = 1920,
            fps = 30,
            pacingSeconds = 2.2,
            keyframeMode = 'alternating',
            videoFiles = [],
            storyboard = [],
            details = { price: '₹15 CR', title: 'smart city delhi airport', specs: 'per family one floor with private lift' }
        } = options;

        const shots = (storyboard && storyboard.length > 0)
            ? storyboard
            : this.parseScriptToStoryboard('', videoFiles, options);

        let totalDurationFrames = 0;
        let videoTrackItemsXml = '';
        let audioTrack1ItemsXml = ''; // Camera audio (if not muted)
        let sfxTrackItemsXml = '';    // SFX (Whoosh, Booms)
        let clipIndex = 1;

        shots.forEach((shot) => {
            const vPath = shot.videoPath;
            const fileName = path.basename(vPath);
            const pace = Number(shot.pacingSeconds) || pacingSeconds;
            const durationFrames = Math.round(pace * fps);
            const startFrame = totalDurationFrames;
            const endFrame = startFrame + durationFrames;

            // Calculate In and Out points based on section (Start, Middle, End, Custom)
            // Estimated clip length = 15s (450 frames at 30fps) if unknown
            const estimatedClipFrames = 450;
            let inFrame = 0;
            if (shot.section === 'middle') {
                inFrame = Math.max(0, Math.round(estimatedClipFrames * 0.4));
            } else if (shot.section === 'end') {
                inFrame = Math.max(0, estimatedClipFrames - durationFrames - 15);
            } else if (shot.section === 'custom' && shot.customIn !== undefined) {
                inFrame = Math.round(Number(shot.customIn) * fps);
            } else {
                // 'start'
                inFrame = 0;
            }
            const outFrame = inFrame + durationFrames;

            const clipId = 'clipitem-v-' + clipIndex;
            const audioClipId = 'clipitem-a1-' + clipIndex;
            const sfxClipId = 'clipitem-sfx-' + clipIndex;
            const fileId = 'file-' + clipIndex;

            // Determine scale keyframes
            let startScale = 100;
            let endScale = 114;
            const kMode = shot.keyframe || keyframeMode;
            if (kMode === 'pull_out' || (kMode === 'alternating' && clipIndex % 2 === 0)) {
                startScale = 114;
                endScale = 100;
            } else if (kMode === 'none') {
                startScale = 100;
                endScale = 100;
            }

            // Transition injection (Cross Dissolve)
            let transitionXml = '';
            if (shot.transition === 'cross_dissolve' && clipIndex > 1) {
                const transDuration = Math.min(15, Math.floor(durationFrames / 2));
                transitionXml = `
        <transitionitem>
          <start>${startFrame - transDuration}</start>
          <end>${startFrame + transDuration}</end>
          <alignment>center</alignment>
          <effect>
            <name>Cross Dissolve</name>
            <effectid>Cross Dissolve</effectid>
            <effectcategory>Dissolve</effectcategory>
            <effecttype>transition</effecttype>
            <mediatype>video</mediatype>
          </effect>
        </transitionitem>`;
            }

            // VIDEO CLIP (If not audio_only)
            if (shot.audioMode !== 'audio_only') {
                videoTrackItemsXml += transitionXml + `
        <clipitem id="${clipId}">
          <name>${fileName} [${shot.section.toUpperCase()}]</name>
          <duration>${estimatedClipFrames * 2}</duration>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <start>${startFrame}</start>
          <end>${endFrame}</end>
          <in>${inFrame}</in>
          <out>${outFrame}</out>
          <file id="${fileId}">
            <name>${fileName}</name>
            <pathurl>file://localhost/${vPath.replace(/\\/g, '/')}</pathurl>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <duration>${estimatedClipFrames * 2}</duration>
            <media>
              <video>
                <samplecharacteristics>
                  <width>1920</width>
                  <height>1080</height>
                </samplecharacteristics>
              </video>
            </media>
          </file>
          <filter>
            <effect>
              <name>Basic Motion</name>
              <effectid>basic</effectid>
              <effectcategory>motion</effectcategory>
              <effecttype>motion</effecttype>
              <mediatype>video</mediatype>
              <parameter>
                <parameterid>scale</parameterid>
                <name>Scale</name>
                <valuemin>0</valuemin>
                <valuemax>1000</valuemax>
                <value>${startScale}</value>
                <keyframe>
                  <when>0</when>
                  <value>${startScale}</value>
                </keyframe>
                <keyframe>
                  <when>${durationFrames}</when>
                  <value>${endScale}</value>
                </keyframe>
              </parameter>
            </effect>
          </filter>
        </clipitem>`;
            }

            // AUDIO CLIP 1 (Camera original sound, only if audioMode === 'both' or 'audio_only')
            if (shot.audioMode === 'both' || shot.audioMode === 'audio_only') {
                audioTrack1ItemsXml += `
        <clipitem id="${audioClipId}">
          <name>${fileName} [Audio]</name>
          <duration>${estimatedClipFrames * 2}</duration>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <start>${startFrame}</start>
          <end>${endFrame}</end>
          <in>${inFrame}</in>
          <out>${outFrame}</out>
          <file id="${fileId}"/>
        </clipitem>`;
            }

            // SFX AUDIO TRACK (Whooshes, Booms, Chimes on Track A2)
            if (shot.sfx && shot.sfx !== 'none') {
                const sfxPath = `C:/PREMIERE_PRO_TOOLKIT/09_SOUND_EFFECTS/${shot.sfx}`.replace(/\\/g, '/');
                const sfxDurationFrames = Math.min(durationFrames, 30);
                sfxTrackItemsXml += `
        <clipitem id="${sfxClipId}">
          <name>${shot.sfx}</name>
          <duration>90</duration>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <start>${startFrame}</start>
          <end>${startFrame + sfxDurationFrames}</end>
          <in>0</in>
          <out>${sfxDurationFrames}</out>
          <file id="file-sfx-${clipIndex}">
            <name>${shot.sfx}</name>
            <pathurl>file://localhost/${sfxPath}</pathurl>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <duration>90</duration>
            <media><audio><samplecharacteristics><depth>16</depth><samplerate>44100</samplerate></samplecharacteristics></audio></media>
          </file>
        </clipitem>`;
            }

            totalDurationFrames = endFrame;
            clipIndex++;
        });

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>${sequenceName}</name>
    <duration>${totalDurationFrames}</duration>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${width}</width>
            <height>${height}</height>
            <pixelaspectratio>square</pixelaspectratio>
            <rate>
              <timebase>${fps}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
          </samplecharacteristics>
        </format>
        <track>
          ${videoTrackItemsXml}
        </track>
      </video>
      <audio>
        <track>
          ${audioTrack1ItemsXml}
        </track>
        <track>
          ${sfxTrackItemsXml}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`;

        return {
            xml: xmlContent,
            totalCuts: clipIndex - 1,
            durationSeconds: totalDurationFrames / fps,
            storyboard: shots
        };
    }

    /**
     * Create XML project and launch directly in Premiere Pro
     */
    buildAndOpenInPremiere(options) {
        const folder = options.folderPath || 'C:/cllg';
        const files = options.videoFiles && options.videoFiles.length > 0
            ? options.videoFiles
            : this.scanFolder(folder);

        if (files.length === 0) {
            throw new Error(`No video files found in ${folder}. Check folder path or select files.`);
        }

        const isVertical = options.aspectRatio === '9:16' || options.isVertical !== false;
        const width = isVertical ? 1080 : 1920;
        const height = isVertical ? 1920 : 1080;
        const cleanTitle = (options.title || 'AI_RealEstate_Project').replace(/[^a-zA-Z0-9_-]/g, '_');
        const seqName = `${cleanTitle}_${isVertical ? '9x16' : '16x9'}`;

        let storyboard = options.storyboard;
        if (!storyboard || storyboard.length === 0) {
            storyboard = this.parseScriptToStoryboard(options.script || options.prompt || '', files, options);
        }

        const result = this.generateSequenceXml({
            sequenceName: seqName,
            width,
            height,
            fps: 30,
            pacingSeconds: Number(options.pacingSeconds) || 2.2,
            keyframeMode: options.keyframeMode || 'alternating',
            videoFiles: files,
            storyboard: storyboard,
            details: options.details || {}
        });

        // Save XML in Toolkit / Premiere folder
        const outDir = 'C:/VideoEditorAI/premiere';
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const xmlPath = path.join(outDir, `${seqName}.xml`);
        fs.writeFileSync(xmlPath, result.xml, 'utf8');

        // Launch Premiere Pro with the generated XML project
        const pproExe = 'C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\Adobe Premiere Pro.exe';
        if (fs.existsSync(pproExe)) {
            spawn(pproExe, [xmlPath], { detached: true, stdio: 'ignore' }).unref();
        }

        return {
            success: true,
            sequenceName: seqName,
            xmlPath: xmlPath,
            totalCuts: result.totalCuts,
            durationSeconds: result.durationSeconds,
            aspectRatio: isVertical ? '9:16 (1080x1920)' : '16:9 (1920x1080)',
            filesUsed: files,
            storyboard: result.storyboard
        };
    }
}

module.exports = new PremiereGenerator();
