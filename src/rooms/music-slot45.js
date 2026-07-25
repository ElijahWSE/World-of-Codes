let audioCtx = null; // module-level — play() sets it, stop() reads it

export const music = {
musicName: 'My Room Music',
play(scene) {
if (audioCtx) {
try { audioCtx.close(); } catch(e) {}
}
audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const masterGain = audioCtx.createGain();
masterGain.gain.setValueAtTime(0.04, audioCtx.currentTime);

const filter = audioCtx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.setValueAtTime(800, audioCtx.currentTime);
filter.Q.setValueAtTime(1.5, audioCtx.currentTime);

masterGain.connect(filter);
filter.connect(audioCtx.destination);

const chordFrequencies = [
  [146.83, 185.00, 220.00, 261.63],
  [130.81, 164.81, 196.00, 246.94],
  [123.47, 155.56, 185.00, 220.00],
  [110.00, 138.59, 164.81, 196.00]
];

const bassFrequencies = [73.42, 65.41, 61.74, 55.00];
const melodyFrequencies = [293.66, 329.63, 392.00, 440.00, 493.88, 587.33];

let step = 0;
const intervalTime = 3000;

const playStep = () => {
  if (!audioCtx || audioCtx.state === 'closed') return;
  
  const now = audioCtx.currentTime;
  const chordIndex = Math.floor(step / 2) % chordFrequencies.length;
  const currentChord = chordFrequencies[chordIndex];
  const bassFreq = bassFrequencies[chordIndex];

  const bassOsc = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  bassOsc.type = 'triangle';
  bassOsc.frequency.setValueAtTime(bassFreq, now);
  bassGain.gain.setValueAtTime(0.0001, now);
  bassGain.gain.exponentialRampToValueAtTime(0.08, now + 0.1);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
  
  bassOsc.connect(bassGain);
  bassGain.connect(masterGain);
  bassOsc.start(now);
  bassOsc.stop(now + 2.9);

  currentChord.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq + (Math.random() * 0.8 - 0.4), now);
    
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.9);
    
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 3.0);
  });

  if (step % 2 === 0) {
    const melFreq = melodyFrequencies[Math.floor(Math.random() * melodyFrequencies.length)];
    const melOsc = audioCtx.createOscillator();
    const melGain = audioCtx.createGain();
    melOsc.type = 'sine';
    melOsc.frequency.setValueAtTime(melFreq, now);
    
    melGain.gain.setValueAtTime(0.0001, now);
    melGain.gain.exponentialRampToValueAtTime(0.015, now + 0.2);
    melGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    
    melOsc.connect(melGain);
    melGain.connect(masterGain);
    melOsc.start(now);
    melOsc.stop(now + 1.5);
  }

  step++;
  if (audioCtx && audioCtx.state !== 'closed') {
    setTimeout(playStep, intervalTime);
  }
};

playStep();
},
stop(scene) {
audioCtx?.close();
audioCtx = null;
},
};