#!/usr/bin/env bash
# One command: stills + MP4.  ./build.sh            (full render)
#                             ./build.sh stills     (just the 3 preview stills)
# Vertical 9:16 reel:         FORMAT=vertical ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
if [ -f assets/vo.mp3 ]; then
  [ assets/vo.words.json -nt assets/vo.mp3 ] || python3 scripts/transcribe.py
else
  rm -f assets/vo.words.json
fi
node scripts/timing.js
# stills: mid-title, mid-letters, closing line
read -r S1 S2 S3 < <(node -e 'const t=require("./out/timeline.json");const L=t.letters;console.log((t.promise+1.6).toFixed(2),(L[Math.floor(L.length/2)]+1.2).toFixed(2),(t.closing+1.4).toFixed(2))')
PREFIX=""; OUT=out/framework-explainer.mp4
if [ "${FORMAT:-}" = "vertical" ]; then PREFIX="vertical-"; OUT=out/framework-reel-vertical.mp4; fi
rm -f out/${PREFIX}still-*.png
node scripts/render.js stills "$S1" "$S2" "$S3"
[ "${1:-}" = "stills" ] && exit 0
python3 scripts/audio.py
node scripts/render.js frames
FPS=$(node -p 'require("./framework.config.json").fps')
ffmpeg -v error -y -framerate "$FPS" -i out/frames/%05d.jpg -i out/mix.wav \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 \
  -c:v libx264 -preset slow -crf 16 -tune film -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -c:a aac -b:a 256k -shortest "$OUT"
rm -rf out/frames
echo "done -> $OUT"
