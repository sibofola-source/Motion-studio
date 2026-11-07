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

| File | What it does |
|---|---|
| `video/index.html` | the scene; every frame is `renderAt(t)` |
| `scripts/timing.js` | builds the timeline (from text, or from the Whisper transcript) |
| `scripts/transcribe.py` | Whisper → `assets/vo.words.json` |
| `scripts/audio.py` | music bed, letter pops, closing hit + shimmer, ducking |
| `scripts/render.js` | Playwright frame renderer |
