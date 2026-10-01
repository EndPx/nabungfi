"""Prepare the credited building loop and an original completion impact.

Offline tooling only: requires numpy and soundfile. Runtime uses the WAVs.
"""

from pathlib import Path
import hashlib
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/audio/pixabay-building-208359.mp3"
DESTINATION = ROOT / "public/audio"
SOURCE_SHA256 = "5368e693f6b31f10798eabbd9aa887f40b59d614b5a50a7281db92306453691f"


def save(name, samples, rate):
    assert np.isfinite(samples).all()
    assert np.abs(samples).max() < 0.95
    sf.write(DESTINATION / name, samples, rate, subtype="PCM_16")
    print(f"{name}: {len(samples) / rate:.3f}s, peak {np.abs(samples).max():.3f}")


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA256
    DESTINATION.mkdir(parents=True, exist_ok=True)
    recording, rate = sf.read(SOURCE, always_2d=True)

    # Remove the quiet lead/tail. Overlap the join instead of looping silence.
    loop = recording[round(0.18 * rate):round(1.88 * rate)].copy()
    loop -= loop.mean(axis=0)
    overlap = round(0.018 * rate)
    crossfade = np.linspace(0, 1, overlap)[:, None]
    join = loop[-overlap:] * (1 - crossfade) + loop[:overlap] * crossfade
    loop = np.concatenate((loop[overlap:-overlap], join))
    loop *= 0.82 / np.abs(loop).max()
    save("building-loop.wav", loop, rate)

    # A short descending body plus woody/plastic impact; no game sample.
    t = np.arange(round(0.64 * rate)) / rate
    rng = np.random.default_rng(208359)
    noise = rng.uniform(-1, 1, len(t))
    low_noise = np.convolve(noise, np.ones(12) / 12, mode="same")
    frequency = 58 + 118 * np.exp(-t / 0.022)
    phase = 2 * np.pi * np.cumsum(frequency) / rate
    attack = np.minimum(1, t / 0.002)
    body = (0.62 * np.sin(phase) + 0.18 * np.sin(phase * 2.03))
    body *= attack * np.exp(-t / 0.11)
    knock = 0.28 * np.sin(2 * np.pi * 245 * t) * np.exp(-t / 0.027)
    click = 0.26 * noise * np.exp(-t / 0.003)
    click += 0.25 * low_noise * np.exp(-t / 0.031)
    impact = np.tanh(body + (knock + click) * attack)
    impact -= impact.mean()
    fade = round(rate * 0.014)
    impact[-fade:] *= np.linspace(1, 0, fade)
    impact[:round(rate * 0.0003)] *= np.linspace(0, 1, round(rate * 0.0003))
    impact *= 0.78 / np.abs(impact).max()
    save("build-complete.wav", impact, rate)


if __name__ == "__main__":
    main()
