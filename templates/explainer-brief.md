# Template: Step-by-step animated explainer

Copy this brief, replace everything in [brackets], and paste it to Claude.
First approved use: "Funded" book explainer (`compositions/funded-explainer/`).

---

CONTEXT: I wrote "[PRODUCT / BOOK NAME]" for [AUDIENCE]. This video plays on [PLATFORMS, e.g. Instagram, YouTube, TikTok, Facebook as a reel / my website].

RESULT: A [LENGTH, e.g. 30]-second animated explainer using brand.css, in [FORMATS, e.g. vertical 1080x1920 for reels + landscape 1920x1080].
Title: "[TITLE]"
Subtitle: "[SUBTITLE]"
Audience line: "[AUDIENCE LINE, or 'none']"

Then these steps appear one at a time, each with a big number, a short headline and one small line under it:
1. [STEP 1 HEADLINE] / [STEP 1 LINE]
2. [STEP 2 HEADLINE] / [STEP 2 LINE]
3. [STEP 3 HEADLINE] / [STEP 3 LINE]

End on "[END CARD NAME]" with "[CALL TO ACTION]" and these links:
- [LABEL 1, e.g. On Payhip] [LINK 1]
- [LABEL 2, e.g. On Amazon] [LINK 2]

Smooth easing, no hard cuts.

VOICEOVER: [VOICE NAME, e.g. Queeneth, or 'none']. Read only the on-screen words: title, subtitle, steps and call to action. Don't read web addresses aloud.

OFF-LIMITS: No stock footage, no people, no words I didn't write, no colors outside brand.css. If anything is unclear, ask me before you build. [ANY EXTRA CONTEXT CLAUDE MAY USE, e.g. "use the book context"]

SHOW YOUR WORK: Before you write code, give me a scene-by-scene storyboard with timings and wait for my OK. After you build it, run --stills 3 and show me the stills before the full render.

NEVER TWICE: When I approve the video, save this brief as a template in the templates folder with [brackets] for the parts that change.

---

## Notes for Claude (how the approved version was built)

- Start from a copy of `compositions/funded-explainer/index.html`. Swap the text, and adjust `--t0` / `--hold` per scene if the voiceover needs more time.
- Default timing for 30s: title 0–6s, steps 6–12 / 12–18 / 18–24s, end card 24–30s with a silent hold at the end.
- Voiceover: generate one take with ElevenLabs, split it at the pauses between scenes, place each part at its scene start, and save it as `voiceover.wav` in the composition folder. `render.js` muxes it in automatically.
- Render commands:
  - `node render.js <name> --stills 3 --size 1080x1920` (reel stills)
  - `node render.js <name> --stills 3` (landscape stills)
  - `node render.js <name> --size 1080x1920` and `node render.js <name>` (full videos)
- In the reel, keep text out of the bottom ~15% so the app's caption and buttons don't cover it. Put clickable links in the post caption or bio.
