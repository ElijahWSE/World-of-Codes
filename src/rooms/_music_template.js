// _music_template.js — The room music contract (THE CONTRACT)
//
// THIS FILE IS GIVEN TO PLAYERS AND TO GEMINI WHEN GENERATING ROOM MUSIC.
// DO NOT rename, remove, or restructure these hooks once finalized.
//
// WHAT ROOM MUSIC IS:
// A short, ambient soundtrack for one room, generated with the Web Audio
// API (oscillators, gain nodes, filters) — NOT an uploaded audio file.
// There's no audio asset anywhere; your code synthesizes the sound itself
// every time it plays. One track per room — submitting new music code
// replaces the room's existing track (reviewed by the admin, same as a
// room or game update).
//
// HOW ROOM MUSIC WORKS:
// Your file exports `music`, an object with the 3 properties below. The
// engine calls play(scene) once when a player enters the room, and
// stop(scene) once when they leave (or when an updated track is approved
// while they're still inside, so the old one doesn't keep playing under
// the new one).
//
// RULES — read carefully:
//   ✅ DO: Create your AudioContext and any oscillator/gain/filter nodes
//          inside play(scene)
//   ✅ DO: Keep a reference to your AudioContext (and anything else you
//          need to stop later) in a variable at the TOP of your file,
//          OUTSIDE play/stop — there's only ever one music instance per
//          room, so a simple module-level variable is enough state
//   ✅ DO: In stop(scene), actually silence everything — close/suspend the
//          AudioContext and/or disconnect your nodes. This is REQUIRED:
//          a running AudioContext is not cleaned up just because the
//          player left the room.
//   ❌ DON'T: import any outside libraries or use require()
//   ❌ DON'T: Use fetch(), XMLHttpRequest, or access the network
//   ❌ DON'T: Use document, localStorage, or any browser API outside of
//          scene and the Web Audio API globals below
//   ❌ DON'T: Load or reference any audio file — there is nowhere to
//          upload one; everything must be synthesized
//
// WEB AUDIO GLOBALS YOU CAN USE (these are plain browser globals, not
// something you need to import):
//   new AudioContext()
//   audioCtx.createOscillator()   — type: 'sine' | 'square' | 'triangle' | 'sawtooth'
//   audioCtx.createGain()
//   audioCtx.createBiquadFilter()
//   node.connect(otherNode) / node.connect(audioCtx.destination)
//   oscillator.frequency.setValueAtTime(hz, audioCtx.currentTime)
//   gainNode.gain.linearRampToValueAtTime(value, audioCtx.currentTime + seconds)
//   oscillator.start() / oscillator.stop()
//   audioCtx.close() — fully tears down the context, the simplest way to stop everything
//
// IMPORTANT — call audioCtx.resume() right after creating your AudioContext:
//   Browsers can start a freshly-created AudioContext in a "suspended" state
//   under their autoplay policy. A suspended context doesn't throw any
//   error and doesn't stop your code — it just silently produces NO SOUND,
//   which is very hard to notice without opening the browser console.
//   Always call audioCtx.resume() immediately after new AudioContext() to
//   guard against this.

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state — holds whatever play() creates so stop() can reach it.
// ─────────────────────────────────────────────────────────────────────────────
let audioCtx = null;

export const music = {
  // ───────────────────────────────────────────────────────────────────────────
  // REQUIRED: musicName
  // A short display name for your track. Must be a string.
  // ───────────────────────────────────────────────────────────────────────────
  musicName: 'My Room Music',

  // ───────────────────────────────────────────────────────────────────────────
  // HOOK: play(scene)
  // Called once when a player enters your room. Build your sound here.
  //
  // Example — a soft looping two-note pad:
  //   audioCtx = new AudioContext();
  //   audioCtx.resume(); // guard against starting suspended, see note above
  //   const gain = audioCtx.createGain();
  //   gain.gain.setValueAtTime(0.05, audioCtx.currentTime); // keep it quiet
  //   gain.connect(audioCtx.destination);
  //   const osc = audioCtx.createOscillator();
  //   osc.type = 'sine';
  //   osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  //   osc.connect(gain);
  //   osc.start();
  // ───────────────────────────────────────────────────────────────────────────
  play(scene) {
    // Build and start your sound here.
  },

  // ───────────────────────────────────────────────────────────────────────────
  // HOOK: stop(scene)
  // Called once when the player leaves the room. REQUIRED — must actually
  // silence what play() started, or the sound leaks into the town square.
  //
  // Example:
  //   audioCtx?.close();
  //   audioCtx = null;
  // ───────────────────────────────────────────────────────────────────────────
  stop(scene) {
    // Silence everything play() started.
    audioCtx?.close();
    audioCtx = null;
  },
};
