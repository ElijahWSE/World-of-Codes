let audioCtx = null;
let isPlaying = false;
let nextTick = 0;
let chordInterval = null;
const tempo = 100;
const chords = [
[349.23, 440.00, 523.25, 659.25],
[392.00, 493.88, 587.33, 659.25],
[329.63, 392.00, 493.88, 554.37],
[220.00, 261.63, 329.63, 440.00]
];
const melody = [523.25, 587.33, 659.25, 783.99, 880.00];

function playTone(freq, time, type = 'sine', duration = 0.5, volume = 0.05) {
if (!audioCtx) return;
const osc = audioCtx.createOscillator();
const gain = audioCtx.createGain();
osc.type = type;
osc.frequency.setValueAtTime(freq, time);
gain.gain.setValueAtTime(volume, time);
gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
osc.connect(gain).connect(audioCtx.destination);
osc.start(time);
osc.stop(time + duration);
}

function scheduleLoop() {
if (!isPlaying) return;
const secPerBeat = 60 / tempo;
while (nextTick < audioCtx.currentTime + 0.2) {
const beatInBar = Math.floor(nextTick / secPerBeat) % 8;
if (beatInBar === 0) playTone(80, nextTick, 'sine', 0.3, 0.1);
if (beatInBar === 4) playTone(150, nextTick, 'triangle', 0.1, 0.03);
if (beatInBar === 0 && Math.floor(nextTick / (secPerBeat * 8)) % 2 === 0) {
const chordIdx = Math.floor((nextTick / secPerBeat) / 8) % chords.length;
chords[chordIdx].forEach(f => playTone(f, nextTick, 'triangle', 2, 0.02));
}
if (Math.random() > 0.7) {
const note = melody[Math.floor(Math.random() * melody.length)];
playTone(note, nextTick + 0.1, 'sine', 0.8, 0.04);
}
nextTick += secPerBeat / 2;
}
chordInterval = setTimeout(scheduleLoop, 50);
}

export const music = {
musicName: 'My Room Music',
play(scene) {
audioCtx = new (window.AudioContext || window.webkitAudioContext)();
audioCtx.resume();
isPlaying = true;
nextTick = audioCtx.currentTime;
scheduleLoop();
},
stop(scene) {
isPlaying = false;
clearTimeout(chordInterval);
audioCtx?.close();
audioCtx = null;
},
};