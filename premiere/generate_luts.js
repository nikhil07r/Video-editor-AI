const fs = require('fs');
const path = require('path');

function generateLUT(filename, title, transformFn) {
    const size = 17;
    let content = 'TITLE "' + title + '"\n';
    content += 'LUT_3D_SIZE ' + size + '\n';
    content += 'DOMAIN_MIN 0.0 0.0 0.0\n';
    content += 'DOMAIN_MAX 1.0 1.0 1.0\n\n';

    for (let b = 0; b < size; b++) {
        for (let g = 0; g < size; g++) {
            for (let r = 0; r < size; r++) {
                const normR = r / (size - 1);
                const normG = g / (size - 1);
                const normB = b / (size - 1);
                const [outR, outG, outB] = transformFn(normR, normG, normB);
                const clamp = v => Math.min(1.0, Math.max(0.0, v)).toFixed(6);
                content += clamp(outR) + ' ' + clamp(outG) + ' ' + clamp(outB) + '\n';
            }
        }
    }

    const outPath = path.join('C:/VideoEditorAI/premiere/presets/luts', filename);
    fs.writeFileSync(outPath, content, 'utf8');
    console.log('Generated LUT:', filename, 'at', outPath);
}

// 1. Luxury Warm (Golden Hour, Warm Amber Lighting)
generateLUT('RealEstate_Luxury_Warm.cube', 'RealEstate_Luxury_Warm', (r, g, b) => {
    const sCurve = x => x * x * (3 - 2 * x);
    let cr = sCurve(r);
    let cg = sCurve(g);
    let cb = sCurve(b);
    cr = cr * 1.08 + 0.02;
    cg = cg * 1.02 + 0.01;
    cb = cb * 0.94;
    return [cr, cg, cb];
});

// 2. Clean Interior (Bright, Crisp Whites, No Yellow Mud)
generateLUT('RealEstate_Clean_Interior.cube', 'RealEstate_Clean_Interior', (r, g, b) => {
    let cr = Math.pow(r, 0.92);
    let cg = Math.pow(g, 0.90);
    let cb = Math.pow(b, 0.88);
    return [cr * 1.03, cg * 1.03, cb * 1.05];
});

// 3. Modern Moody (Architectural Drama, Deep Blacks)
generateLUT('RealEstate_Moody_Modern.cube', 'RealEstate_Moody_Modern', (r, g, b) => {
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    let cr = r > 0.05 ? Math.pow(r, 1.15) : r * 0.8;
    let cg = g > 0.05 ? Math.pow(g, 1.12) : g * 0.8;
    let cb = b > 0.05 ? Math.pow(b, 1.08) : b * 0.8;
    cr = cr * 0.85 + lum * 0.15;
    cg = cg * 0.85 + lum * 0.15;
    cb = cb * 0.90 + lum * 0.10;
    return [cr, cg, cb];
});
