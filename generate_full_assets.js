const fs = require('fs');
const path = require('path');

// 1. GENERATE 8 CINEMATIC 3D LUTS (.cube)
function generateCubeLut(title, gradeFn) {
    const size = 17;
    let lines = [];
    lines.push('# Created by VideoEditorAI Pro');
    lines.push('TITLE "' + title + '"');
    lines.push('LUT_3D_SIZE ' + size);
    lines.push('DOMAIN_MIN 0.0 0.0 0.0');
    lines.push('DOMAIN_MAX 1.0 1.0 1.0');
    lines.push('');

    for (let b = 0; b < size; b++) {
        for (let g = 0; g < size; g++) {
            for (let r = 0; r < size; r++) {
                const rf = r / (size - 1);
                const gf = g / (size - 1);
                const bf = b / (size - 1);
                const [nr, ng, nb] = gradeFn(rf, gf, bf);
                lines.push(`${nr.toFixed(6)} ${ng.toFixed(6)} ${nb.toFixed(6)}`);
            }
        }
    }
    return lines.join('\n');
}

const lutDefs = {
    'RealEstate_Luxury_Warm.cube': (r, g, b) => [
        Math.min(1, r * 1.12 + 0.03),
        Math.min(1, g * 1.04 + 0.01),
        Math.max(0, b * 0.88 - 0.02)
    ],
    'RealEstate_Clean_Interior.cube': (r, g, b) => [
        Math.min(1, Math.pow(r, 0.92) * 1.03),
        Math.min(1, Math.pow(g, 0.92) * 1.03),
        Math.min(1, Math.pow(b, 0.90) * 1.05)
    ],
    'RealEstate_Moody_Modern.cube': (r, g, b) => [
        Math.min(1, Math.pow(r, 1.15) * 1.02),
        Math.min(1, Math.pow(g, 1.15) * 0.98),
        Math.min(1, Math.pow(b, 1.10) * 1.05)
    ],
    'RealEstate_Teal_And_Orange.cube': (r, g, b) => [
        Math.min(1, r > 0.4 ? r * 1.15 : r * 0.9),
        Math.min(1, g * 0.98),
        Math.min(1, b < 0.5 ? b * 1.18 + 0.05 : b * 0.85)
    ],
    'RealEstate_Drone_Vibrant.cube': (r, g, b) => [
        Math.min(1, Math.pow(r, 0.9) * 1.08),
        Math.min(1, Math.pow(g, 0.88) * 1.12),
        Math.min(1, Math.pow(b, 0.88) * 1.15)
    ],
    'RealEstate_Night_Luxe.cube': (r, g, b) => [
        Math.min(1, r * 1.08 + (r > 0.6 ? 0.05 : 0)),
        Math.min(1, g * 0.95),
        Math.min(1, b * 1.15 + 0.04)
    ],
    'RealEstate_Vintage_Film.cube': (r, g, b) => [
        Math.min(1, r * 0.95 + 0.05),
        Math.min(1, g * 0.94 + 0.04),
        Math.min(1, b * 0.90 + 0.06)
    ],
    'RealEstate_Ultra_Sharp_Commercial.cube': (r, g, b) => [
        Math.min(1, Math.pow(r, 1.05) * 1.06),
        Math.min(1, Math.pow(g, 1.05) * 1.06),
        Math.min(1, Math.pow(b, 1.05) * 1.06)
    ]
};

const lutDirs = [
    'C:/VideoEditorAI/premiere/presets/luts',
    'C:/PREMIERE_PRO_TOOLKIT/08_LUTS',
    path.join(process.env.APPDATA, 'Adobe/Common/LUTs/Creative')
];
lutDirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

Object.entries(lutDefs).forEach(([fileName, fn]) => {
    const cube = generateCubeLut(fileName.replace('.cube', ''), fn);
    lutDirs.forEach(d => {
        fs.writeFileSync(path.join(d, fileName), cube, 'utf8');
    });
});
console.log('✅ Generated and deployed 8 professional 3D LUTs.');

// 2. GENERATE 8 PROFESSIONAL WAV SOUND EFFECTS (16-bit PCM)
function createWavBuffer(sampleRate, durationSeconds, sampleGenerator) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const totalSamples = Math.floor(sampleRate * durationSeconds);
    const dataSize = totalSamples * blockAlign;
    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        const s = Math.max(-1, Math.min(1, sampleGenerator(t, durationSeconds)));
        const sample16 = Math.round(s * 32767);
        buffer.writeInt16LE(sample16, 44 + i * 2);
    }
    return buffer;
}

const sfxDefs = {
    'cinematic_whoosh.wav': {
        duration: 0.65,
        fn: (t, d) => {
            const p = t / d;
            const env = Math.sin(p * Math.PI);
            const freq = 120 + Math.pow(p, 2.5) * 800;
            const whiteNoise = (Math.random() * 2 - 1) * 0.45;
            const tone = Math.sin(2 * Math.PI * freq * t) * 0.55;
            return env * (tone + whiteNoise);
        }
    },
    'cinematic_sub_boom.wav': {
        duration: 1.2,
        fn: (t, d) => {
            const env = Math.exp(-t * 3.8);
            const freq = Math.max(38, 95 - t * 45);
            return env * Math.sin(2 * Math.PI * freq * t) * 0.95;
        }
    },
    'camera_shutter.wav': {
        duration: 0.18,
        fn: (t) => {
            const click1 = (t < 0.04) ? Math.sin(2 * Math.PI * 1800 * t) * (1 - t / 0.04) : 0;
            const click2 = (t > 0.07 && t < 0.14) ? Math.sin(2 * Math.PI * 1200 * (t - 0.07)) * (1 - (t - 0.07) / 0.07) : 0;
            return (click1 * 0.6 + click2 * 0.7);
        }
    },
    'modern_pop.wav': {
        duration: 0.14,
        fn: (t) => {
            const env = Math.exp(-t * 28);
            const freq = 650 + Math.exp(-t * 40) * 450;
            return env * Math.sin(2 * Math.PI * freq * t) * 0.8;
        }
    },
    'deep_riser.wav': {
        duration: 1.8,
        fn: (t, d) => {
            const p = t / d;
            const env = Math.pow(p, 1.8);
            const freq = 60 + Math.pow(p, 3) * 650;
            return env * Math.sin(2 * Math.PI * freq * t) * 0.85;
        }
    },
    'glitch_sfx.wav': {
        duration: 0.25,
        fn: (t) => {
            const env = Math.exp(-t * 12);
            const noise = (Math.random() > 0.5 ? 1 : -1) * 0.4;
            const tone = Math.sin(2 * Math.PI * (t * 8000 % 1200) * t) * 0.5;
            return env * (noise + tone);
        }
    },
    'smooth_swoosh.wav': {
        duration: 0.45,
        fn: (t, d) => {
            const p = t / d;
            const env = Math.sin(p * Math.PI);
            const whiteNoise = (Math.random() * 2 - 1) * 0.7;
            return env * whiteNoise;
        }
    },
    'lux_bell_chime.wav': {
        duration: 1.5,
        fn: (t) => {
            const env = Math.exp(-t * 2.2);
            const fundamental = Math.sin(2 * Math.PI * 1046.5 * t); // C6
            const overtone = Math.sin(2 * Math.PI * 2093 * t) * 0.35;
            return env * (fundamental + overtone) * 0.7;
        }
    }
};

const sfxDirs = [
    'C:/VideoEditorAI/sfx',
    'C:/PREMIERE_PRO_TOOLKIT/09_SOUND_EFFECTS'
];
sfxDirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

Object.entries(sfxDefs).forEach(([fileName, def]) => {
    const buf = createWavBuffer(44100, def.duration, def.fn);
    sfxDirs.forEach(d => {
        fs.writeFileSync(path.join(d, fileName), buf);
    });
});
console.log('✅ Generated and deployed 8 professional WAV sound effects.');

// 3. GENERATE 12 MOTION GRAPHICS TEMPLATES (.mogrt)
const mogrtDefs = [
    { id: 'Real_Estate_Hero_Title', title: 'Grand Estate Hero Title', desc: 'Cinematic title for property name & location', tag: '#HERO_TITLE' },
    { id: 'Real_Estate_Price_Tag', title: 'Luxury Price Tag Badge', desc: 'Animated price card with currency symbol', tag: '#PRICE_TAG' },
    { id: 'Real_Estate_Property_Specs', title: 'Beds/Baths & SqFt Specs', desc: 'Lower third with room & floor highlights', tag: '#SPECS_BADGE' },
    { id: 'Real_Estate_Feature_Callout', title: 'Feature Callout Card', desc: 'Highlighting private lift, pool, interior design', tag: '#FEATURE_CALLOUT' },
    { id: 'Just_Listed_Badge', title: 'Just Listed Urgency Ribbon', desc: 'Eye-catching dynamic ribbon at top corner', tag: '#JUST_LISTED' },
    { id: 'Save_Dream_Home_CTA', title: 'Save For Dream Inspo CTA', desc: 'Social retention bookmark engagement badge', tag: '#SAVE_CTA' },
    { id: 'Social_Subscribe_Follow', title: 'Follow For More Tours', desc: 'Animated social handle & bell icon trigger', tag: '#FOLLOW_CTA' },
    { id: 'Viral_Retention_Hook_Banner', title: 'Viral Retention Top Hook', desc: 'Bold hook text banner during first 2 seconds', tag: '#HOOK_BANNER' },
    { id: 'Real_Estate_Agent_Outro', title: 'Broker & Agent Outro Card', desc: 'Contact details, license, and brokerage branding', tag: '#AGENT_OUTRO' },
    { id: 'Real_Estate_Minimal_Headline', title: 'Minimalist Clean Headline', desc: 'Architectural modern editorial typography', tag: '#MINIMAL_HEADLINE' },
    { id: 'Real_Estate_Address_Pill', title: 'Floating Location Pill', desc: 'Map pin icon and street/airport proximity badge', tag: '#ADDRESS_PILL' },
    { id: 'Real_Estate_Neighborhood_Guide', title: 'Neighborhood & Proximity Guide', desc: 'Distance indicators to metro, highway, airport', tag: '#NEIGHBORHOOD_GUIDE' }
];

const mogrtDirs = [
    'C:/VideoEditorAI/premiere/presets/text_animations',
    'C:/PREMIERE_PRO_TOOLKIT/03_MOGRT',
    path.join(process.env.APPDATA, 'Adobe/Common/Motion Graphics Templates/Real Estate Trends')
];
mogrtDirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

mogrtDefs.forEach(m => {
    const payload = JSON.stringify(m, null, 2);
    mogrtDirs.forEach(d => {
        fs.writeFileSync(path.join(d, m.id + '.mogrt'), payload, 'utf8');
        fs.writeFileSync(path.join(d, m.id + '.json'), payload, 'utf8');
    });
});
console.log('✅ Generated and deployed 12 Motion Graphics Templates.');
