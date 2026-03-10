# Model ID Referansı

## Güncel Model Eşleştirmesi

| Model | ID | Proto Enum | Durum |
|-------|-----|-----------|-------|
| Gemini 3 Flash | 1018 | `MODEL_PLACEHOLDER_M18` | ✅ Aktif |
| Gemini 3 Pro (Low) | 1007 | `MODEL_PLACEHOLDER_M07` | ✅ Aktif |
| Gemini 3 Pro (High) | 1008 | `MODEL_PLACEHOLDER_M08` | ✅ Aktif |
| Claude Sonnet 4.5 | 333 | Doğrudan enum | ✅ Aktif |
| Claude Sonnet 4.5 (Thinking) | 334 | Doğrudan enum | ✅ Aktif |
| Claude Opus 4.6 (Thinking) | **1026** | `MODEL_PLACEHOLDER_M26` | ✅ Aktif |
| GPT-OSS-120B (Medium) | 342 | Doğrudan enum | ✅ Aktif |
| Claude Opus 4.5 (Thinking) | ~~1012~~ | `MODEL_PLACEHOLDER_M12` | ❌ Deprecated |

## ID Kaynağı

Model ID'leri **Antigravity'nin dahili protobuf enum tanımlarından** gelir.

### Birincil Kaynak

GitHub'daki `hegemonikon` reposunda:

```
mekhane/ochema/docs/ls-standalone-reference.md
```

Bu dosya LS API referansıdır ve tüm model → enum ID eşleştirmelerini içerir.

### ID Pattern

İki farklı pattern var:

1. **1000+ serisi**: `MODEL_PLACEHOLDER_M{N}` → ID = `1000 + N`
   - Örnek: `M26` → 1026, `M18` → 1018
2. **Düşük ID'ler**: Doğrudan proto enum değeri (333, 334, 342 gibi)

### Güncelleme Kontrolü

Yeni model eklendiğinde veya mevcut ID deprecated olduğunda:

1. `hegemonikon` reposundaki `ls-standalone-reference.md` dosyasını kontrol et
2. `MODEL_PLACEHOLDER_M{N}` pattern'ini ara
3. Yeni ID'yi `src/protobuf.ts` → `MODEL_IDS` objesine ekle
4. Gerekirse `ModelName` type'ını `src/types.ts`'de güncelle
5. `npx tsc` ile build et

### Brute-Force Keşif (Alternatif)

Kaynak doküman güncel değilse `probe-models.mjs` script'i ile tarama yapılabilir:

```bash
node .agent/scripts/probe-models.mjs
```

Bu script 300+ ID'yi sırayla dener ve çalışanları listeler.

> **Son güncelleme:** 2026-02-15 — ID 1026 (Claude Opus 4.6) doğrulandı.
