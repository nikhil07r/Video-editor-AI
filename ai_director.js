const path = require('path');
const CapCutEngine = require('./capcut_engine');

class AIDirector {
    constructor() {
        this.engine = new CapCutEngine();
    }

    /**
     * Parse human prompt and compile into full editing directives
     * @param {string} prompt - Human prompt e.g. "Create a high energy reel with zoom in animations, circle mask, portrait roto cutout with neon stroke, and vibrant filter"
     * @param {Array<string>} videoPaths - List of local video files
     * @param {Object} customOverrides - Any manual overrides
     */
    parsePromptToRecipe(prompt, videoPaths, customOverrides = {}) {
        const lower = prompt.toLowerCase();
        const recipe = {
            projectName: customOverrides.projectName || `AI_Edit_${Date.now()}`,
            clips: [],
            texts: [],
            filter: { enabled: false }
        };

        // Determine pacing & cut interval
        let cutDuration = 3.0; // default 3 seconds
        if (lower.includes('fast') || lower.includes('high energy') || lower.includes('reel') || lower.includes('tiktok')) {
            cutDuration = 2.0;
        } else if (lower.includes('slow') || lower.includes('cinematic') || lower.includes('documentary')) {
            cutDuration = 4.5;
        }

        // Determine Masking Preference
        const hasMask = lower.includes('mask') || lower.includes('circle mask') || lower.includes('rectangle mask');
        const maskType = lower.includes('circle') ? 'circle' : (lower.includes('rectangle') ? 'rectangle' : 'circle');

        // Determine Roto / Cutout Preference
        const hasRoto = lower.includes('roto') || lower.includes('cutout') || lower.includes('remove background') || lower.includes('portrait');
        let strokeColor = '#00F0FF'; // Cyber cyan
        if (lower.includes('green') || lower.includes('neon green')) strokeColor = '#00FF66';
        if (lower.includes('red') || lower.includes('crimson')) strokeColor = '#FF2244';
        if (lower.includes('gold') || lower.includes('yellow')) strokeColor = '#FFD700';
        if (lower.includes('purple') || lower.includes('violet')) strokeColor = '#BD00FF';

        // Determine Animation Preference
        const hasAnimation = lower.includes('animation') || lower.includes('zoom') || lower.includes('slide') || lower.includes('fade');
        const inAnim = lower.includes('zoom') ? 'Zoom In' : (lower.includes('slide') ? 'Slide Up' : 'Fade In');
        const outAnim = lower.includes('zoom out') ? 'Zoom Out' : 'Fade Out';

        // Determine Filter Preference
        const hasFilter = lower.includes('filter') || lower.includes('color') || lower.includes('cinematic') || lower.includes('grade') || lower.includes('vibrant');
        if (hasFilter) {
            recipe.filter = {
                enabled: true,
                sharpen: lower.includes('8k') || lower.includes('sharp') ? 0.35 : 0.20,
                saturation: lower.includes('vibrant') ? 0.25 : 0.12,
                lightness: 0.05,
                hue: lower.includes('warm') ? 15 : (lower.includes('cool') ? -15 : 0)
            };
        }

        // Build clips timeline
        let currentTime = 0;
        let clipIndex = 0;

        for (const vidPath of videoPaths) {
            // Create 2 to 3 slices per video to simulate human editing rhythm
            const slices = [0, cutDuration, cutDuration * 2];

            for (let i = 0; i < slices.length; i++) {
                const sliceStart = slices[i];
                const isRotoClip = hasRoto && (clipIndex % 2 === 1); // alternate roto on subject
                const isMaskClip = hasMask && (clipIndex % 2 === 0);

                recipe.clips.push({
                    path: vidPath,
                    startTime: sliceStart,
                    duration: cutDuration,
                    // Roto Tool / AI Matting
                    roto: {
                        enabled: isRotoClip,
                        type: 'portrait',
                        strokeColor: strokeColor,
                        strokeSize: 14
                    },
                    // Masking
                    mask: {
                        enabled: isMaskClip,
                        type: maskType,
                        width: 1.0,
                        height: 0.7,
                        centerX: 0,
                        centerY: 0,
                        feather: 20,
                        invert: false
                    },
                    // Animation
                    animation: {
                        inAnim: hasAnimation ? inAnim : 'Zoom In',
                        inDuration: 0.5,
                        outAnim: hasAnimation ? outAnim : 'Fade Out',
                        outDuration: 0.4
                    },
                    speed: 1.0,
                    volume: 1.0,
                    transform: {
                        scale: isRotoClip ? 1.08 : 1.0,
                        x: 0,
                        y: 0,
                        rotation: 0
                    }
                });

                clipIndex++;
            }
        }

        // Add dynamic AI title if prompt indicates
        const isRealEstate = lower.includes('real estate') || lower.includes('property') || lower.includes('estate') || lower.includes('house') || lower.includes('luxury');

        if (isRealEstate) {
            recipe.texts.push({
                text: customOverrides.title || "MODERN LUXURY ESTATE",
                startTime: 0.2,
                duration: 2.8,
                fontSize: 9.5,
                color: [0.95, 0.85, 0.45], // Luxury Gold
                y: -0.65
            });
            recipe.texts.push({
                text: customOverrides.price || "$2,850,000 | 4 BEDS • 4.5 BATHS",
                startTime: 3.0,
                duration: 3.0,
                fontSize: 7.5,
                color: [1, 1, 1], // Pure White
                y: -0.60
            });
            recipe.texts.push({
                text: customOverrides.features || "CHEF'S KITCHEN • INFINITY POOL",
                startTime: 6.2,
                duration: 3.0,
                fontSize: 7.0,
                color: [0.85, 0.95, 1.0], // Ice Blue
                y: -0.60
            });
        } else {
            recipe.texts.push({
                text: customOverrides.title || "AI DIRECTED EDIT",
                startTime: 0.5,
                duration: 2.5,
                fontSize: 9.0,
                color: [1, 1, 1],
                y: -0.6
            });
        }

        return recipe;
    }

    /**
     * Execute full prompt editing workflow directly into CapCut
     */
    async executeEditFromPrompt(prompt, videoPaths, customOptions = {}) {
        const recipe = this.parsePromptToRecipe(prompt, videoPaths, customOptions);
        console.log(`[AI Director] Generated Recipe with ${recipe.clips.length} cuts.`);
        const result = this.engine.createFullProject(recipe);
        return {
            ...result,
            recipeSummary: {
                totalCuts: recipe.clips.length,
                featuresApplied: {
                    rotoTool: recipe.clips.some(c => c.roto && c.roto.enabled),
                    masking: recipe.clips.some(c => c.mask && c.mask.enabled),
                    animations: recipe.clips.some(c => c.animation && c.animation.inAnim),
                    filterGrade: recipe.filter.enabled,
                    captions: recipe.texts.length > 0
                }
            }
        };
    }
}

module.exports = AIDirector;
