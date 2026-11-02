const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Utility to generate CapCut style UUID
function generateUUID() {
    return crypto.randomUUID().toUpperCase();
}

// Convert seconds to CapCut microseconds (1 second = 1,000,000 microseconds)
function toMicroseconds(seconds) {
    return Math.round(seconds * 1000000);
}

class CapCutEngine {
    constructor() {
        this.draftRootDir = path.join(process.env.LOCALAPPDATA, 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
        this.rootMetaPath = path.join(this.draftRootDir, 'root_meta_info.json');
        this.cacheEffectDir = path.join(process.env.LOCALAPPDATA, 'CapCut', 'User Data', 'Cache', 'effect');
    }

    /**
     * Check if CapCut draft environment is ready
     */
    isReady() {
        return fs.existsSync(this.draftRootDir);
    }

    /**
     * List all existing drafts
     */
    listDrafts() {
        if (!fs.existsSync(this.rootMetaPath)) return [];
        try {
            const data = JSON.parse(fs.readFileSync(this.rootMetaPath, 'utf8'));
            return (data.all_draft_store || []).map(d => ({
                id: d.draft_id,
                name: d.draft_name,
                path: d.draft_fold_path,
                lastModified: new Date(Math.round(d.tm_draft_modified / 1000)).toLocaleString()
            }));
        } catch (e) {
            console.error('Error reading root_meta_info:', e);
            return [];
        }
    }

    /**
     * Build a full-fledged CapCut project
     * @param {Object} options
     *   projectName: string
     *   canvas: { width: 1920, height: 1080, fps: 30 }
     *   clips: Array<{
     *     path: string,
     *     startTime: number (seconds in source),
     *     duration: number (seconds),
     *     // Effects & Roto
     *     roto: { enabled: boolean, type: 'portrait' | 'chroma', strokeColor: string, strokeSize: number },
     *     mask: { enabled: boolean, type: 'circle' | 'rectangle' | 'line' | 'mirror', feather: number, invert: boolean, centerX: number, centerY: number, width: number, height: number },
     *     animation: { inAnim: string, inDuration: number, outAnim: string, outDuration: number },
     *     filter: { enabled: boolean, brightness: number, contrast: number, saturation: number, sharpen: number, temperature: number },
     *     speed: number,
     *     volume: number,
     *     transform: { scale: number, x: number, y: number, rotation: number }
     *   }>
     *   texts: Array<{ text: string, startTime: number, duration: number, fontSize: number, color: string, y: number }>
     *   music: Array<{ path: string, startTime: number, duration: number, volume: number }>
     */
    createFullProject(options) {
        const {
            projectName = `AI_Edit_${Date.now()}`,
            canvas = { width: 1920, height: 1080, fps: 30, ratio: '16:9' },
            clips = [],
            texts = [],
            music = []
        } = options;

        const draftId = generateUUID();
        const projectFolderName = projectName.replace(/[\/\\:*?"<>|]/g, '_');
        const projectFolderPath = path.join(this.draftRootDir, projectFolderName).replace(/\\/g, '/');

        if (!fs.existsSync(projectFolderPath)) {
            fs.mkdirSync(projectFolderPath, { recursive: true });
        }

        const draftContentPath = path.join(projectFolderPath, 'draft_content.json').replace(/\\/g, '/');
        const draftMetaPath = path.join(projectFolderPath, 'draft_meta_info.json').replace(/\\/g, '/');

        // Master Materials Collections
        const materials = {
            videos: [],
            audios: [],
            canvases: [],
            speeds: [],
            sound_channel_mappings: [],
            material_colors: [],
            vocal_separations: [],
            loudnesses: [],
            common_mask: [],
            material_animations: [],
            effects: [],
            hsl: [],
            chromas: [],
            texts: [],
            placeholder_infos: []
        };

        // Master Tracks
        const videoTrack = {
            id: generateUUID(),
            type: 'video',
            flag: 0,
            attribute: 1,
            name: 'Main Video Track',
            is_default_name: true,
            segments: []
        };

        const overlayTrack = {
            id: generateUUID(),
            type: 'video',
            flag: 0,
            attribute: 1,
            name: 'Overlay & B-Roll Track',
            is_default_name: true,
            segments: []
        };

        const filterTrack = {
            id: generateUUID(),
            type: 'adjust',
            flag: 0,
            attribute: 0,
            name: 'AI Color & Effects Track',
            is_default_name: true,
            segments: []
        };

        const textTrack = {
            id: generateUUID(),
            type: 'text',
            flag: 0,
            attribute: 0,
            name: 'AI Captions & Graphics',
            is_default_name: true,
            segments: []
        };

        const audioTrack = {
            id: generateUUID(),
            type: 'audio',
            flag: 0,
            attribute: 0,
            name: 'Background Audio Track',
            is_default_name: true,
            segments: []
        };

        let currentTimelineTime = 0; // in microseconds

        // Process each video clip
        clips.forEach((clip, index) => {
            const videoMaterialId = generateUUID();
            const sourceDurationMicro = toMicroseconds(clip.duration || 5);
            const sourceStartMicro = toMicroseconds(clip.startTime || 0);
            const targetDurationMicro = sourceDurationMicro;

            // 1. Video Material Entry
            const videoMat = {
                id: videoMaterialId,
                unique_id: crypto.randomBytes(16).toString('hex'),
                type: 'video',
                duration: sourceStartMicro + sourceDurationMicro + 1000000,
                path: (clip.path || '').replace(/\\/g, '/'),
                width: canvas.width,
                height: canvas.height,
                category_name: 'local',
                material_name: path.basename(clip.path || `clip_${index}.mp4`),
                has_audio: true,
                crop: { upper_left_x: 0, upper_left_y: 0, upper_right_x: 1, upper_right_y: 0, lower_left_x: 0, lower_left_y: 1, lower_right_x: 1, lower_right_y: 1 },
                crop_ratio: 'free',
                crop_scale: 1,
                // ROTO TOOL / MATTING
                matting: {
                    flag: clip.roto && clip.roto.enabled ? (clip.roto.type === 'chroma' ? 1 : 2) : 0, // 2 = Auto portrait cutout (roto tool)
                    path: '',
                    interactiveTime: [],
                    has_use_quick_brush: false,
                    strokes: [],
                    has_use_quick_eraser: false,
                    expansion: 0,
                    feather: 0,
                    reverse: false,
                    custom_matting_id: '',
                    enable_matting_stroke: clip.roto && clip.roto.strokeColor ? true : false,
                    is_clould: false,
                    mask_video_path: '',
                    cloud_product_fps: 0
                },
                video_mask_stroke: {
                    resource_id: '',
                    path: '',
                    type: 'solid',
                    color: (clip.roto && clip.roto.strokeColor) || '#00E5FF', // Neon Cyan Outline
                    size: (clip.roto && clip.roto.strokeSize) || 12,
                    alpha: 1,
                    distance: 0,
                    texture: 0,
                    horizontal_shift: 0,
                    vertical_shift: 0
                },
                video_mask_shadow: {
                    resource_id: '',
                    path: '',
                    color: '#000000',
                    alpha: 0.6,
                    blur: 15,
                    distance: 5,
                    angle: 45
                },
                video_algorithm: {
                    algorithms: [],
                    noise_reduction: null,
                    quality_enhance: null,
                    super_resolution: null,
                    smart_complement_frame: null
                }
            };
            materials.videos.push(videoMat);

            // 2. Aux Materials for this segment
            const extraMaterialRefs = [];

            // A. Speed Material
            const speedId = generateUUID();
            materials.speeds.push({
                id: speedId,
                type: 'speed',
                mode: 0,
                speed: clip.speed || 1.0,
                curve_speed: null
            });
            extraMaterialRefs.push(speedId);

            // B. Canvas Material
            const canvasId = generateUUID();
            materials.canvases.push({
                id: canvasId,
                type: 'canvas_color',
                color: '',
                blur: 0,
                image: '',
                album_image: '',
                image_id: '',
                image_name: '',
                source_platform: 0,
                team_id: ''
            });
            extraMaterialRefs.push(canvasId);

            // C. Sound Channel Mapping
            const soundMapId = generateUUID();
            materials.sound_channel_mappings.push({
                id: soundMapId,
                type: '',
                audio_channel_mapping: 0,
                is_config_open: false
            });
            extraMaterialRefs.push(soundMapId);

            // D. Vocal Separation
            const vocalId = generateUUID();
            materials.vocal_separations.push({
                id: vocalId,
                type: 'vocal_separation',
                choice: 0,
                production_path: '',
                time_range: null
            });
            extraMaterialRefs.push(vocalId);

            // E. MASKING (Circle, Rectangle, Linear, etc.)
            if (clip.mask && clip.mask.enabled) {
                const maskId = generateUUID();
                const maskType = clip.mask.type || 'circle';
                materials.common_mask.push({
                    id: maskId,
                    type: 'mask',
                    category: 'video',
                    category_name: '',
                    category_id: '',
                    name: maskType.charAt(0).toUpperCase() + maskType.slice(1),
                    resource_type: maskType,
                    resource_id: '7374021188315517456',
                    path: path.join(this.cacheEffectDir, '794455087/3ab1c47350d987c8ad415497e020a38b').replace(/\\/g, '/'),
                    config: {
                        width: clip.mask.width !== undefined ? clip.mask.width : 1.0,
                        height: clip.mask.height !== undefined ? clip.mask.height : 0.6,
                        centerX: clip.mask.centerX || 0,
                        centerY: clip.mask.centerY || 0,
                        rotation: clip.mask.rotation || 0,
                        feather: clip.mask.feather || 15,
                        expansion: 0,
                        roundCorner: clip.mask.roundCorner || 0,
                        invert: clip.mask.invert || false,
                        aspectRatio: 1
                    },
                    platform: 'all'
                });
                extraMaterialRefs.push(maskId);
            }

            // F. ANIMATIONS (In, Out, Combo)
            if (clip.animation && (clip.animation.inAnim || clip.animation.outAnim)) {
                const animMatId = generateUUID();
                const animList = [];

                if (clip.animation.inAnim) {
                    animList.push({
                        id: generateUUID(),
                        type: 'in',
                        start: 0,
                        duration: toMicroseconds(clip.animation.inDuration || 0.6),
                        name: clip.animation.inAnim,
                        platform: 'all',
                        resource_id: '6798320902548230669',
                        panel: 'video',
                        material_type: 'video'
                    });
                }

                if (clip.animation.outAnim) {
                    animList.push({
                        id: generateUUID(),
                        type: 'out',
                        start: targetDurationMicro - toMicroseconds(clip.animation.outDuration || 0.6),
                        duration: toMicroseconds(clip.animation.outDuration || 0.6),
                        name: clip.animation.outAnim,
                        platform: 'all',
                        resource_id: '6798320902548230669',
                        panel: 'video',
                        material_type: 'video'
                    });
                }

                materials.material_animations.push({
                    id: animMatId,
                    type: 'sticker_animation',
                    animations: animList,
                    multi_language_current: 'none'
                });
                extraMaterialRefs.push(animMatId);
            }

            // 3. Segment Object
            const segment = {
                id: generateUUID(),
                source_timerange: {
                    start: sourceStartMicro,
                    duration: sourceDurationMicro
                },
                target_timerange: {
                    start: currentTimelineTime,
                    duration: targetDurationMicro
                },
                render_timerange: {
                    start: 0,
                    duration: 0
                },
                speed: clip.speed || 1,
                volume: clip.volume !== undefined ? clip.volume : 1,
                last_nonzero_volume: 1,
                clip: {
                    scale: {
                        x: (clip.transform && clip.transform.scale) || 1,
                        y: (clip.transform && clip.transform.scale) || 1
                    },
                    rotation: (clip.transform && clip.transform.rotation) || 0,
                    transform: {
                        x: (clip.transform && clip.transform.x) || 0,
                        y: (clip.transform && clip.transform.y) || 0
                    },
                    flip: { vertical: false, horizontal: false },
                    alpha: 1
                },
                uniform_scale: { on: true, value: (clip.transform && clip.transform.scale) || 1 },
                material_id: videoMaterialId,
                extra_material_refs: extraMaterialRefs,
                render_index: 0,
                keyframe_refs: [],
                visible: true,
                enable_video_mask: clip.mask && clip.mask.enabled ? true : false,
                enable_mask_stroke: clip.roto && clip.roto.strokeColor ? true : false,
                enable_mask_shadow: clip.roto && clip.roto.strokeColor ? true : false,
                source: 'segmentsourcenormal'
            };

            // Place on main or overlay track
            if (clip.isOverlay) {
                overlayTrack.segments.push(segment);
            } else {
                videoTrack.segments.push(segment);
                currentTimelineTime += targetDurationMicro;
            }
        });

        // 4. Global AI Filter / Color Adjustment Layer
        if (options.filter && options.filter.enabled) {
            const f = options.filter;
            const adjustSegId = generateUUID();
            const adjustMatId = generateUUID();
            const filterRefs = [];

            // Sharpen / Clear / Particle effects
            const sharpenMatId = generateUUID();
            materials.effects.push({
                id: sharpenMatId,
                effect_id: '7501974767453474064',
                resource_id: '7501974767453474064',
                name: 'Sharpen',
                type: 'sharpen',
                value: f.sharpen || 0.25,
                visible: true,
                category_name: 'Adjust'
            });
            filterRefs.push(sharpenMatId);

            // HSL Material
            const hslMatId = generateUUID();
            materials.hsl.push({
                id: hslMatId,
                constant_material_id: generateUUID(),
                hsl_color_type: 1,
                hue: f.hue || 0,
                saturation: f.saturation || 0.15,
                lightness: f.lightness || 0.05,
                interacting: true,
                type: 'hsl',
                custom_color: '#FFE64444'
            });
            filterRefs.push(hslMatId);

            filterTrack.segments.push({
                id: adjustSegId,
                source_timerange: null,
                target_timerange: {
                    start: 0,
                    duration: currentTimelineTime || 10000000
                },
                render_timerange: { start: 0, duration: 0 },
                speed: 1,
                material_id: adjustMatId,
                extra_material_refs: filterRefs,
                enable_lut: true,
                enable_adjust: true,
                enable_hsl: true,
                visible: true
            });
        }

        // 5. Captions / Titles
        texts.forEach(t => {
            const textMatId = generateUUID();
            const textDuration = toMicroseconds(t.duration || 3);
            const textStart = toMicroseconds(t.startTime || 0);

            materials.texts.push({
                id: textMatId,
                type: 'text',
                content: JSON.stringify({
                    styles: [
                        { fill: { alpha: 1, content: { render_type: 'solid', solid: { color: t.color || [1, 1, 1] } } }, size: t.fontSize || 8.0 }
                    ],
                    text: t.text
                }),
                align_type: 1,
                font_title: 'System'
            });

            textTrack.segments.push({
                id: generateUUID(),
                source_timerange: null,
                target_timerange: {
                    start: textStart,
                    duration: textDuration
                },
                render_timerange: { start: 0, duration: 0 },
                clip: {
                    scale: { x: 1, y: 1 },
                    rotation: 0,
                    transform: { x: 0, y: t.y || -0.6 },
                    alpha: 1
                },
                material_id: textMatId,
                extra_material_refs: [],
                visible: true
            });
        });

        // Assemble active tracks
        const activeTracks = [];
        if (videoTrack.segments.length > 0) activeTracks.push(videoTrack);
        if (overlayTrack.segments.length > 0) activeTracks.push(overlayTrack);
        if (filterTrack.segments.length > 0) activeTracks.push(filterTrack);
        if (textTrack.segments.length > 0) activeTracks.push(textTrack);
        if (audioTrack.segments.length > 0) activeTracks.push(audioTrack);

        const draftContent = {
            id: draftId,
            version: 360000,
            new_version: '189.0.0',
            name: projectName,
            duration: currentTimelineTime,
            create_time: Math.round(Date.now() / 1000),
            update_time: Math.round(Date.now() / 1000),
            fps: canvas.fps || 30,
            color_space: 0,
            canvas_config: {
                ratio: canvas.ratio || '16:9',
                width: canvas.width || 1920,
                height: canvas.height || 1080,
                background: null
            },
            tracks: activeTracks,
            materials: materials,
            keyframes: [],
            platform: {
                os: 'windows',
                os_version: '10.0.26300',
                app_id: 359289,
                app_version: '9.6.0',
                app_source: 'cc'
            }
        };

        const draftMeta = {
            draft_id: draftId,
            draft_name: projectName,
            draft_fold_path: projectFolderPath,
            draft_json_file: draftContentPath,
            draft_root_path: this.draftRootDir.replace(/\\/g, '/'),
            draft_cover: 'draft_cover.jpg',
            tm_draft_create: Date.now() * 1000,
            tm_draft_modified: Date.now() * 1000,
            draft_is_ai_shorts: false,
            streaming_edit_draft_ready: true
        };

        // Write project files
        fs.writeFileSync(draftContentPath, JSON.stringify(draftContent, null, 2), 'utf8');
        fs.writeFileSync(draftMetaPath, JSON.stringify(draftMeta, null, 2), 'utf8');

        // Register in root_meta_info.json so CapCut displays it on home screen
        this.registerInRootMeta(draftMeta);

        return {
            success: true,
            draftId,
            projectName,
            projectFolderPath,
            timelineDurationSeconds: currentTimelineTime / 1000000,
            tracksCount: activeTracks.length,
            clipsCount: clips.length
        };
    }

    registerInRootMeta(draftMeta) {
        if (!fs.existsSync(this.rootMetaPath)) return;
        try {
            const rootData = JSON.parse(fs.readFileSync(this.rootMetaPath, 'utf8'));
            if (!Array.isArray(rootData.all_draft_store)) {
                rootData.all_draft_store = [];
            }

            // Remove previous entry with same id or name if exists
            rootData.all_draft_store = rootData.all_draft_store.filter(
                d => d.draft_id !== draftMeta.draft_id && d.draft_name !== draftMeta.draft_name
            );

            // Prepend new project so it appears at top of CapCut home screen
            rootData.all_draft_store.unshift({
                cloud_draft_cover: false,
                cloud_draft_sync: false,
                draft_cloud_last_action_download: false,
                draft_cloud_purchase_info: '',
                draft_cloud_template_id: '',
                draft_cloud_tutorial_info: '',
                draft_cloud_videocut_purchase_info: '',
                draft_cover: path.join(draftMeta.draft_fold_path, 'draft_cover.jpg').replace(/\\/g, '/'),
                draft_fold_path: draftMeta.draft_fold_path,
                draft_id: draftMeta.draft_id,
                draft_is_ai_shorts: false,
                draft_is_cloud_temp_draft: false,
                draft_is_infinite_canvas_draft: false,
                draft_is_invisible: false,
                draft_is_pippit_draft: false,
                draft_is_web_article_video: false,
                draft_json_file: draftMeta.draft_json_file,
                draft_name: draftMeta.draft_name,
                draft_new_version: '189.0.0',
                draft_root_path: draftMeta.draft_root_path,
                draft_timeline_materials_size: 100000,
                draft_type: '',
                streaming_edit_draft_ready: true,
                tm_draft_create: draftMeta.tm_draft_create,
                tm_draft_modified: draftMeta.tm_draft_modified
            });

            fs.writeFileSync(this.rootMetaPath, JSON.stringify(rootData, null, 2), 'utf8');
        } catch (e) {
            console.error('Error updating root_meta_info:', e);
        }
    }
}

module.exports = CapCutEngine;
