const fs = require('fs');
const path = require('path');

// Utility to create standard 16-bit Mono PCM WAV file buffer
function createWavBuffer(sampleRate, samples) {
    const numSamples = samples.length;
    const blockAlign = 2; // 1 channel * 2 bytes
    const byteRate = sampleRate * blockAlign;
    const buffer = Buffer.alloc(44 + numSamples * 2);

    // RIFF Header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVE', 8);

    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34); // BitsPerSample (16)

    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);

    // Write samples
    for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        const val = s < 0 ? s * 32768 : s * 32767;
        buffer.writeInt16LE(Math.round(val), 44 + i * 2);
    }

    return buffer;
}

const sfxDir = 'C:/VideoEditorAI/sfx';
if (!fs.existsSync(sfxDir)) fs.mkdirSync(sfxDir, { recursive: true });

const sampleRate = 44100;

// 1. Cinematic Transition Whoosh (Smooth frequency sweep + noise)
function makeWhoosh() {
    const duration = 0.6;
    const numSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / numSamples;
        // Bell envelope
        const envelope = Math.sin(Math.PI * t);
        // Frequency sweep from 120Hz to 600Hz and back down
        const freq = 120 + 480 * Math.sin(Math.PI * t);
        const tone = Math.sin(2 * Math.PI * freq * (i / sampleRate));
        const noise = (Math.random() * 2 - 1) * 0.4;
        samples[i] = (tone * 0.6 + noise * 0.4) * envelope * 0.8;
    }
    return createWavBuffer(sampleRate, samples);
}

// 2. Cinematic Deep Sub Boom (Impact hit for establishing drone shots)
function makeSubBoom() {
    const duration = 1.2;
    const numSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-3.5 * t); // Exponential decay
        const freq = 75 * Math.exp(-2.0 * t) + 35; // Pitch drop 110Hz -> 35Hz
        const tone = Math.sin(2 * Math.PI * freq * t);
        samples[i] = tone * env * 0.9;
    }
    return createWavBuffer(sampleRate, samples);
}

// 3. Crisp Camera Shutter Click (For property photos & spec card popups)
function makeCameraClick() {
    const duration = 0.15;
    const numSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env1 = Math.exp(-70 * t);
        const env2 = t > 0.05 ? Math.exp(-60 * (t - 0.05)) : 0;
        const click1 = (Math.random() * 2 - 1) * env1;
        const click2 = (Math.random() * 2 - 1) * env2;
        samples[i] = (click1 + click2 * 0.8) * 0.7;
    }
    return createWavBuffer(sampleRate, samples);
}

// 4. Modern UI Pop / Bubble (For price badge appearance)
function makePop() {
    const duration = 0.12;
    const numSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-45 * t);
        const freq = 350 + 550 * (1 - t / duration); // Pitch sweep up
        samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.8;
    }
    return createWavBuffer(sampleRate, samples);
}

fs.writeFileSync(path.join(sfxDir, 'cinematic_whoosh.wav'), makeWhoosh());
fs.writeFileSync(path.join(sfxDir, 'cinematic_sub_boom.wav'), makeSubBoom());
fs.writeFileSync(path.join(sfxDir, 'camera_shutter.wav'), makeCameraClick());
fs.writeFileSync(path.join(sfxDir, 'modern_pop.wav'), makePop());

console.log('Generated 4 royalty-free cinematic SFX in C:/VideoEditorAI/sfx:');
console.log('✓ cinematic_whoosh.wav');
console.log('✓ cinematic_sub_boom.wav');
console.log('✓ camera_shutter.wav');
console.log('✓ modern_pop.wav');
