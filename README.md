# Motion-studio

## Framework explainer (20 s, 1920×1080, 30 fps)

`out/framework-explainer.mp4`, with preview stills in `out/still-*.png`.

**Edit `framework.config.json`** to change the framework name, promise, letters (any number), closing line, end card and colours. Then run:

```bash
./build.sh stills   # just the 3 preview stills
./build.sh          # stills + full MP4
```

- **Voiceover:** drop your recording at `assets/vo.mp3`. The build transcribes it with Whisper (faster-whisper, installed on first run) and times every scene to your voice. Each letter lights when you say the letter or its word, and the music ducks under your voice. With no file, timing comes from the amount of text on screen.
- **Music:** drop a track at `assets/music.mp3` to use it as the bed. Otherwise a soft synth bed is generated in code.

**Current narration:** cloned voice "Queeneth" (ElevenLabs, eleven_v4), take 1, sped up 1.15× with a 0.35 s lead-in so it fits 20 s. Both raw takes are in `assets/vo-takes/`. To use take 2, run:

```bash
ffmpeg -y -i assets/vo-takes/take2.mp3 -af "atempo=1.15,adelay=350|350" assets/vo.mp3 && rm -f assets/vo.words.json && ./build.sh
```

| File | What it does |
|---|---|
| `video/index.html` | the scene; every frame is `renderAt(t)` |
| `scripts/timing.js` | builds the timeline (from text, or from the Whisper transcript) |
| `scripts/transcribe.py` | Whisper → `assets/vo.words.json` |
| `scripts/audio.py` | music bed, letter pops, closing hit + shimmer, ducking |
| `scripts/render.js` | Playwright frame renderer |
