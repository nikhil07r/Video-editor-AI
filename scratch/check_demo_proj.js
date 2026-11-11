const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('C:/Premier/demo.prproj');
let xml = '';
try {
    xml = zlib.gunzipSync(buf).toString('utf8');
} catch (e) {
    xml = buf.toString('utf8');
}

console.log('--- Checking Sequences in demo.prproj ---');
let pos = 0;
while (true) {
    const sIdx = xml.indexOf('<Sequence ObjectURef=', pos);
    if (sIdx === -1) break;
    const nameStart = xml.indexOf('<Name>', sIdx);
    const nameEnd = xml.indexOf('</Name>', nameStart);
    if (nameStart !== -1 && nameEnd !== -1 && nameStart - sIdx < 1000) {
        console.log('Sequence:', xml.substring(nameStart + 6, nameEnd));
    }
    pos = sIdx + 20;
}

console.log('--- Checking Video Tracks and TrackItems ---');
const trackItemCount = (xml.match(/<TrackItem/g) || []).length;
console.log('Total TrackItems on timeline:', trackItemCount);

// Check if any MOGRT or effects exist
console.log('Contains MOGRT/Graphics?', xml.includes('mogrt') || xml.includes('Graphic'));
console.log('Contains Scale keyframes?', xml.includes('Scale') || xml.includes('Keyframe'));
