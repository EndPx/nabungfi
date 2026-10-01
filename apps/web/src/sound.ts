interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  startedAt: number;
  level: number;
}

let context: AudioContext | undefined;
let master: GainNode | undefined;
let enabled = false;
let loading: Promise<void> | undefined;
let buildingBuffer: AudioBuffer | undefined;
let completionBuffer: AudioBuffer | undefined;
let building: Voice | undefined;
const voices = new Set<Voice>();

export async function unlockAudio(): Promise<boolean> {
  try {
    if (!context) {
      context = new AudioContext({ latencyHint: "interactive" });
      master = context.createGain();
      master.gain.value = enabled ? 0.8 : 0;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.1;
      master.connect(compressor).connect(context.destination);
    }
    // Resume in the user gesture, before fetching or decoding anything.
    if (context.state === "suspended") await context.resume();
    const audioContext = context;
    loading ??= Promise.all(
      ["building-loop.wav", "build-complete.wav"].map(async (name) => {
        const response = await fetch(`${import.meta.env.BASE_URL}audio/${name}`);
        if (!response.ok) throw new Error(`Could not load ${name}`);
        return audioContext.decodeAudioData(await response.arrayBuffer());
      }),
    ).then(([loop, finish]) => {
      buildingBuffer = loop;
      completionBuffer = finish;
    });
    await loading;
    return context.state === "running";
  } catch {
    loading = undefined;
    return false;
  }
}

function stopVoice(voice: Voice, when: number) {
  voice.gain.gain.cancelScheduledValues(when);
  voice.gain.gain.setValueAtTime(voice.level, when);
  voice.gain.gain.linearRampToValueAtTime(0, when + 0.018);
  voice.source.stop(when + 0.02);
}

export function stopBuildAudio() {
  if (!context) return;
  for (const voice of voices) stopVoice(voice, context.currentTime);
  building = undefined;
}

export function setAudioEnabled(value: boolean) {
  enabled = value;
  if (!value) stopBuildAudio();
  if (!context || !master) return;
  master.gain.cancelScheduledValues(context.currentTime);
  master.gain.setTargetAtTime(value ? 0.8 : 0, context.currentTime, 0.008);
}

function play(buffer: AudioBuffer, level: number, when: number, loop = false) {
  if (!context || !master || !enabled || context.state !== "running") return;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(level, when + 0.008);
  source.connect(gain).connect(master);
  const voice = { source, gain, startedAt: when, level };
  voices.add(voice);
  source.onended = () => {
    voices.delete(voice);
    if (building === voice) building = undefined;
    source.disconnect();
    gain.disconnect();
  };
  source.start(when);
  return voice;
}

export function playBuildStep() {
  // One continuous recording, not a full clip restarted for every piece.
  if (building || !context || !buildingBuffer) return;
  building = play(buildingBuffer, 0.94, context.currentTime, true);
}

export function playBuildFinish(pieceCount: number) {
  if (!context || !completionBuffer || !enabled) return;
  // Keep even a one-piece build audible before the single finishing impact.
  const finishAt = Math.max(
    context.currentTime + 0.085,
    (building?.startedAt ?? context.currentTime) + 0.16,
  );
  if (building) {
    stopVoice(building, finishAt - 0.04);
    building = undefined;
  }
  const weight = Math.min(1, 0.7 + Math.log2(Math.max(1, pieceCount)) * 0.045);
  play(completionBuffer, 0.76 * weight, finishAt);
}
