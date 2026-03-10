/**
 * CLI argüman parsing, yardım ve utility fonksiyonları.
 *
 * Node.js `process.argv`'den konfigürasyon çıkarır.
 * Global runtime state yönetir (verbose, stopRequested).
 *
 * @module cli
 * @packageDocumentation
 */
import type { LoopConfig, RuntimeState } from "./types.js";
/**
 * Global runtime state'e erişim sağlar.
 *
 * Modüller arası state paylaşımı için kullanılır.
 * `verbose` ve `stopRequested` flag'lerini içerir.
 *
 * @returns Mutable runtime state referansı
 */
export declare function getState(): RuntimeState;
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
export declare function log(msg: string): void;
/**
 * Belirtilen süre kadar bekler.
 *
 * @param ms - Bekleme süresi (milisaniye)
 * @returns Süre dolduğunda resolve olan Promise
 */
export declare function sleep(ms: number): Promise<void>;
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
export declare function parseArgs(): LoopConfig;
/**
 * CLI yardım metnini ekrana yazdırır.
 *
 * Tüm konfigürasyon seçeneklerini ve model listesini içerir.
 */
export declare function printHelp(): void;
//# sourceMappingURL=cli.d.ts.map