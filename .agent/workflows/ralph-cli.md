---
description: Run Ralph Loop CLI — standalone autonomous loop without extension
---

# Ralph Loop CLI Workflow

Standalone Node.js script ile otonom AI loop çalıştırır. Extension gerektirmez.

## Ön Koşullar

- Antigravity IDE açık olmalı
- Projede `TASKS.md` olmalı

## Adımlar

// turbo-all

1. Dry-run test — bağlantı kontrol:

```bash
node .agent/scripts/ralph-loop/dist/index.js --dry-run --verbose
```

1. Loop başlat (varsayılan: TASKS.md, Claude Opus 4.6, 50 iterasyon):

```bash
node .agent/scripts/ralph-loop/dist/index.js
```

1. Özel ayarlarla çalıştır:

```bash
node .agent/scripts/ralph-loop/dist/index.js \
  --task TASKS.md \
  --progress progress.txt \
  --prompt AGENT.md \
  --model "Gemini 3 Flash" \
  --mode Fast \
  --max-iterations 30
```

1. Claude ile çalıştır:

```bash
node .agent/scripts/ralph-loop/dist/index.js --model "Claude Sonnet 4.5"
```

## Durdurma

- `Ctrl+C` ile güvenli kapatma (3s cleanup süresi)

## Sorun Giderme

- "Antigravity process bulunamadı" → Antigravity IDE'yi aç
- "OAuth token bulunamadı" → Antigravity'ye giriş yap
- "gRPC portu doğrulanamadı" → Tüm portlar denenmiş, Antigravity'yi yeniden başlat
