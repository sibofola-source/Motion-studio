"""Transcribes assets/vo.mp3 with Whisper (word timestamps) -> assets/vo.words.json.
Installs faster-whisper on first run if it isn't there."""
import json, os, subprocess, sys
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')

ROOT = os.path.join(os.path.dirname(__file__), '..')
src = os.path.join(ROOT, 'assets', 'vo.mp3')
dst = os.path.join(ROOT, 'assets', 'vo.words.json')
if not os.path.exists(src):
    sys.exit('no assets/vo.mp3 - skipping voiceover')
try:
    from faster_whisper import WhisperModel
except ImportError:
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'faster-whisper'], check=True)
    from faster_whisper import WhisperModel

model = WhisperModel(os.environ.get('WHISPER_MODEL', 'small.en'), device='cpu', compute_type='int8')
# decode with ffmpeg (avoids PyAV version issues) -> 16 kHz mono float32
import numpy as np
pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'],
                     capture_output=True, check=True).stdout
segments, _ = model.transcribe(np.frombuffer(pcm, np.float32), word_timestamps=True)
words = [{'word': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3)}
         for seg in segments for w in seg.words]
json.dump(words, open(dst, 'w'), indent=1)
print(f'{len(words)} words -> assets/vo.words.json')
print(' '.join(f"{w['word']}@{w['start']:.2f}" for w in words))
