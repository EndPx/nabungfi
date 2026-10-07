"""Render the two finish cues from locally retained generated MP3s.

Offline tooling: NumPy and SoundFile; no runtime or API credentials required.
"""
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100

def main():
    out = ROOT / "public/audio"
    partial, rate = sf.read(ROOT / "assets/audio/finish-progress-source.mp3", always_2d=True)
    assert rate == RATE and np.isfinite(partial).all()
    partial -= partial.mean(axis=0)
    partial *= .82 / np.abs(partial).max()
    partial[:88] *= np.linspace(0,1,88)[:,None]
    partial[-660:] *= np.linspace(1,0,660)[:,None]
    sf.write(out / "build-progress.wav", partial, RATE, subtype="PCM_16")

    result = np.zeros((round(1.8*RATE),2))
    t = np.arange(round(.52*RATE)) / RATE
    frequency = 190 + 780*(1-np.exp(-t/.09))
    phase = 2*np.pi*np.cumsum(frequency) / RATE
    envelope = np.sin(np.pi*np.minimum(t/.52,1))**1.5 * np.exp(-t*2)
    boing = (np.sin(phase)+.23*np.sin(phase*2)) * envelope * .17
    start = round(.02*RATE)
    result[start:start+len(t)] += boing[:,None]

    landing, rate = sf.read(ROOT / "assets/audio/finish-goal-source.mp3", always_2d=True)
    assert rate == RATE and np.isfinite(landing).all()
    landing -= landing.mean(axis=0)
    landing *= .72 / np.abs(landing).max()
    start = round(.49*RATE)
    length = min(len(landing),len(result)-start)
    result[start:start+length] += landing[:length]
    for onset,frequency in [(0.73,784),(0.83,988),(0.94,1175)]:
        t = np.arange(round(.60*RATE)) / RATE
        sparkle = (np.sin(2*np.pi*frequency*t)+.26*np.sin(2*np.pi*frequency*2*t))
        sparkle *= np.exp(-t/.13)*np.minimum(1,t/.005)*.075
        start = round(onset*RATE)
        result[start:start+len(t)] += sparkle[:,None]
    result -= result.mean(axis=0)
    result *= .86 / np.abs(result).max()
    result[-880:] *= np.linspace(1,0,880)[:,None]
    assert np.isfinite(result).all() and np.abs(result).max()<.9
    sf.write(out / "goal-complete.wav",result,RATE,subtype="PCM_16")

if __name__ == "__main__":
    main()
