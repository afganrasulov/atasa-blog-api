/**
 * CLI argüman parsing, yardım ve utility fonksiyonları.
 *
 * Node.js `process.argv`'den konfigürasyon çıkarır.
 * Global runtime state yönetir (verbose, stopRequested).
 *
 * @module cli
 * @packageDocumentation
 */

import path from "node:path";

import type { LoopConfig, CascadeMode, ModelName, RuntimeState } from "./types.js";
import { DEFAULT_MODEL, MODEL_IDS } from "./protobuf.js";

// ─────────────────────────────────────────────
// Runtime State
// ─────────────────────────────────────────────

/** Global runtime state */
const state: RuntimeState = {
    verbose: false,
    stopRequested: false,
};

/**
 * Global runtime state'e erişim sağlar.
 *
 * Modüller arası state paylaşımı için kullanılır.
 * `verbose` ve `stopRequested` flag'lerini içerir.
 *
 * @returns Mutable runtime state referansı
 */
export function getState(): RuntimeState {
    return state;
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

/**
 * Timestamped log mesajı yazdırır.
 *
 * Format: `[HH:MM:SS] message`
 *
 * @param msg - Yazdırılacak mesaj
 *
 * @example
 * ```ts
 * log("Bağlantı kuruldu"); // [14:30:05] Bağlantı kuruldu
 * ```
 */
export function log(msg: string): void {
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] ${msg}`);
}

/**
 * Belirtilen süre kadar bekler.
 *
 * @param ms - Bekleme süresi (milisaniye)
 * @returns Süre dolduğunda resolve olan Promise
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// Argument Parsing
// ─────────────────────────────────────────────

/**
 * CLI argümanlarını parse eder ve {@link LoopConfig} döndürür.
 *
 * Desteklenen argümanlar:
 *
 * | Flag | Kısa | Varsayılan | Açıklama |
 * |------|-------|------------|----------|
 * | `--workspace` | `-w` | `cwd` | Proje dizini |
 * | `--task` | `-t` | `TASKS.md` | Task dosyası |
 * | `--progress` | `-p` | `progress.txt` | İlerleme dosyası |
 * | `--prompt` | — | `AGENT.md` | System prompt dosyası |
 * | `--mode` | `-m` | `Fast` | Cascade modu |
 * | `--model` | — | `Claude Opus 4.6` | AI model |
 * | `--max-iterations` | — | `50` | Maks iterasyon |
 * | `--stable-threshold` | — | `7` | Tamamlanma hassasiyeti |
 * | `--dry-run` | — | `false` | Sadece discovery |
 * | `--verbose` | `-v` | `false` | Detaylı log |
 * | `--help` | `-h` | — | Yardım göster |
 *
 * @returns Parse edilmiş konfigürasyon
 */
export function parseArgs(): LoopConfig {
    const args = process.argv.slice(2);
    const config: LoopConfig = {
        workspaceRoot: process.cwd(),
        taskFile: "TASKS.md",
        progressFile: "progress.txt",
        promptFile: "AGENT.md",
        mode: "Fast",
        model: DEFAULT_MODEL,
        maxIterations: 50,
        stableThreshold: 7,
        dryRun: false,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const next = args[i + 1];

        switch (arg) {
            case "--workspace":
            case "-w":
                config.workspaceRoot = path.resolve(next);
                i++;
                break;
            case "--task":
            case "-t":
                config.taskFile = next;
                i++;
                break;
            case "--progress":
            case "-p":
                config.progressFile = next;
                i++;
                break;
            case "--prompt":
                config.promptFile = next;
                i++;
                break;
            case "--mode":
            case "-m":
                config.mode = next as CascadeMode;
                i++;
                break;
            case "--model":
                config.model = next as ModelName;
                i++;
                break;
            case "--max-iterations":
                config.maxIterations = parseInt(next, 10);
                i++;
                break;
            case "--stable-threshold":
                config.stableThreshold = parseInt(next, 10);
                i++;
                break;
            case "--dry-run":
                config.dryRun = true;
                break;
            case "--verbose":
            case "-v":
                state.verbose = true;
                break;
            case "--help":
            case "-h":
                printHelp();
                process.exit(0);
            default:
                log(`⚠️  Bilinmeyen argüman: ${arg}`);
                printHelp();
                process.exit(1);
        }
    }

    return config;
}

// ─────────────────────────────────────────────
// Help Text
// ─────────────────────────────────────────────

/**
 * CLI yardım metnini ekrana yazdırır.
 *
 * Tüm konfigürasyon seçeneklerini ve model listesini içerir.
 */
export function printHelp(): void {
    const modelList = Object.entries(MODEL_IDS)
        .map(([name, id]) => `  "${name}"${" ".repeat(30 - name.length)}(${id})`)
        .join("\n");

    console.log(`
Ralph Loop CLI v2.0 — Otonom AI Coding Loop (TypeScript)

Kullanım:
  node dist/index.js [options]

Seçenekler:
  --workspace, -w    Proje dizini (default: cwd)
  --task, -t         Task dosyası (default: TASKS.md)
  --progress, -p     Progress dosyası (default: progress.txt)
  --prompt           Prompt dosyası (default: AGENT.md)
  --mode, -m         Mode: Fast | Planning (default: Fast)
  --model            Model adı (default: "${DEFAULT_MODEL}")
  --max-iterations   Maks iterasyon (default: 50)
  --stable-threshold Completion algılama hassasiyeti (default: 7)
  --dry-run          Sadece discovery, loop çalıştırma
  --verbose, -v      Detaylı log
  --help, -h         Bu yardım

Modeller:
${modelList}

Örnekler:
  node dist/index.js --dry-run
  node dist/index.js --workspace /path/to/project --max-iterations 20
  node dist/index.js --model "Claude Sonnet 4.5" --mode Planning
  `);
}
