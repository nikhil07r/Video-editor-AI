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
     * Generate an FCP XML sequence file natively readable by Premiere Pro
     */
    generateSequenceXml(options) {
        const {
            sequenceName = 'AI_RealEstate_AutoCut',
            width = 1080,
            height = 1920,
            fps = 30,
            pacingSeconds = 2.2,
            keyframeMode = 'alternating', // alternating, push_in, pull_out, none
            videoFiles = [],
            details = { price: '₹15 CR', title: 'smart city delhi airport', specs: 'per family one floor with private lift' }
        } = options;

        let totalDurationFrames = 0;
        let trackItemsXml = '';
        let clipIndex = 1;

        videoFiles.forEach((vPath) => {
            const fileName = path.basename(vPath);
            const slices = [0, pacingSeconds]; // 2 distinct shots per video

            slices.forEach((sliceStartSec) => {
                const durationFrames = Math.round(pacingSeconds * fps);
                const startFrame = totalDurationFrames;
                const endFrame = startFrame + durationFrames;
                const inFrame = Math.round(sliceStartSec * fps);
                const outFrame = inFrame + durationFrames;

                const clipId = 'clipitem-' + clipIndex;
                const fileId = 'file-' + clipIndex;

                // Determine scale keyframes
                let startScale = 100;
                let endScale = 114;
                if (keyframeMode === 'pull_out' || (keyframeMode === 'alternating' && clipIndex % 2 === 0)) {
                    startScale = 114;
                    endScale = 100;
                } else if (keyframeMode === 'none') {
                    startScale = 100;
                    endScale = 100;
                }

                trackItemsXml += `
        <clipitem id="${clipId}">
          <name>${fileName} [Cut ${clipIndex}]</name>
          <duration>${durationFrames * 10}</duration>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <start>${startFrame}</start>
          <end>${endFrame}</end>
          <in>${inFrame}</in>
          <out>${outFrame}</out>
          <file id="${fileId}">
            <name>${fileName}</name>
            <pathurl>file://localhost/${vPath.replace(/\\/g, '/')}</pathurl>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <duration>${durationFrames * 20}</duration>
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

                totalDurationFrames = endFrame;
                clipIndex++;
            });
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
          ${trackItemsXml}
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;

        return {
            xml: xmlContent,
            totalCuts: clipIndex - 1,
            durationSeconds: totalDurationFrames / fps
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
            throw new Error(`No video files found in ${folder}. Check folder path.`);
        }

        const isVertical = options.aspectRatio === '9:16' || options.isVertical !== false;
        const width = isVertical ? 1080 : 1920;
        const height = isVertical ? 1920 : 1080;
        const cleanTitle = (options.title || 'AI_RealEstate_Project').replace(/[^a-zA-Z0-9_-]/g, '_');
        const seqName = `${cleanTitle}_${isVertical ? '9x16' : '16x9'}`;

        const result = this.generateSequenceXml({
            sequenceName: seqName,
            width,
            height,
            fps: 30,
            pacingSeconds: Number(options.pacingSeconds) || 2.2,
            keyframeMode: options.keyframeMode || 'alternating',
            videoFiles: files,
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
            filesUsed: files
        };
    }
}

module.exports = new PremiereGenerator();
