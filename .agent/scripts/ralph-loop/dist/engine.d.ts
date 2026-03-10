/**
 * Ralph Loop engine — iteratif agent çalıştırma.
 *
 * Tek bir agent session'ını (cascade) yönetir:
 * 1. Task dosyasını okur
 * 2. Prompt oluşturur
 * 3. Agent'a gönderir
 * 4. Tamamlanmasını bekler
 * 5. Done marker kontrolü yapar
 * 6. Tekrarlar veya durur
 *
 * @module engine
 * @packageDocumentation
 */
import type { LoopConfig } from "./types.js";
import { AntigravityClient } from "./client.js";
/**
 * Benzersiz loop ID üretir.
 *
 * Her loop çalıştırmasına özel 8-hex-char ID.
 * Done marker'da kullanılır.
 *
 * @returns 8 karakter hex string
 *
 * @example
 * ```ts
 * generateLoopId(); // "a6301053"
 * ```
 */
export declare function generateLoopId(): string;
/**
 * Loop ID'den done marker string'i üretir.
 *
 * Agent tüm task'ları tamamladığında progress dosyasına
 * bu marker'ı ekler. Loop bu marker'ı görerek durur.
 *
 * @param loopId - {@link generateLoopId} tarafından üretilmiş ID
 * @returns Done marker string'i
 *
 * @example
 * ```ts
 * generateDoneMarker("a6301053"); // "ralph-done-a6301053"
 * ```
 */
export declare function generateDoneMarker(loopId: string): string;
/**
 * Progress dosyasında done marker'ın varlığını kontrol eder.
 *
 * Dosyanın son 5 satırına bakar (performans için).
 * Dosya yoksa `false` döner.
 *
 * @param progressFilePath - Progress dosyasının tam yolu
 * @param doneMarker - Aranacak marker string'i
 * @returns `true` eğer marker bulunduysa
 */
export declare function isDoneMarkerPresent(progressFilePath: string, doneMarker: string): boolean;
/**
 * Agent'a gönderilecek prompt'u oluşturur.
 *
 * Prompt yapısı:
 * 1. (Opsiyonel) AGENT.md içeriği
 * 2. Identity + instructions
 * 3. Done marker bilgisi
 *
 * Agent'a verilen anahtar direktifler:
 * - Tek seferde tek task tamamla
 * - Progress dosyasına append-only yaz
 * - Task dosyasını düzenleme
 * - Tüm task'lar bittiyse done marker'ı ekle
 *
 * @param config - Loop konfigürasyonu
 * @param loopId - Mevcut loop ID
 * @param promptContent - AGENT.md içeriği (opsiyonel)
 * @returns Tam prompt string'i
 */
export declare function buildPrompt(config: LoopConfig, loopId: string, promptContent: string | null): string;
/**
 * Ana iteratif loop'u çalıştırır.
 *
 * Her iterasyonda:
 * 1. Done marker kontrolü → bulunduysa dur
 * 2. Yeni cascade başlat
 * 3. Prompt oluştur ve gönder
 * 4. Agent tamamlanmasını bekle
 * 5. Done marker hatırlatması gönder
 * 6. Cascade'i sil
 *
 * Loop durma koşulları:
 * - Done marker bulundu ✅
 * - Max iterasyon sınırına ulaşıldı ⚠️
 * - Ctrl+C ile durduruldu ⛔
 * - Fatal hata ❌
 *
 * @param client - Bağlı {@link AntigravityClient} instance
 * @param config - Loop konfigürasyonu
 */
export declare function runLoop(client: AntigravityClient, config: LoopConfig): Promise<void>;
//# sourceMappingURL=engine.d.ts.map