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

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { LoopConfig } from "./types.js";
import { AntigravityClient } from "./client.js";
import { log, sleep, getState } from "./cli.js";

// ─────────────────────────────────────────────
// Loop ID & Done Marker
// ─────────────────────────────────────────────

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
export function generateLoopId(): string {
    return crypto.randomBytes(4).toString("hex");
}

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
export function generateDoneMarker(loopId: string): string {
    return `ralph-done-${loopId}`;
}

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
export function isDoneMarkerPresent(progressFilePath: string, doneMarker: string): boolean {
    try {
        if (!fs.existsSync(progressFilePath)) return false;
        const content = fs.readFileSync(progressFilePath, "utf8");
        const lines = content.split(/\r?\n/);
        const tail = lines.slice(-5).join("\n");
        return tail.includes(doneMarker);
    } catch {
        return false;
    }
}

// ─────────────────────────────────────────────
// Prompt Builder
// ─────────────────────────────────────────────

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
export function buildPrompt(config: LoopConfig, loopId: string, promptContent: string | null): string {
    const { taskFile, progressFile } = config;
    let message = "";

    if (promptContent) {
        message += promptContent + "\n\n---\n\n";
    }

    message += `# Instructions
## Identity
You are an autonomous AI sub-agent, specifically created to handle atomic coding tasks.
You are one of multiple sequential sub-agents in a loop.

Read the task list from \`${taskFile}\` and check progress in \`${progressFile}\`.

## Your Job
1. Review \`${progressFile}\` to see what's been done
2. Pick the next uncompleted task from \`${taskFile}\`
3. Implement one logical commit's worth of work. If the task is large, complete a meaningful chunk.
4. Append your progress to \`${progressFile}\` (only the part you worked on if task is large)
5. Commit your changes to the current branch unless said otherwise in \`${taskFile}\`

## Rules
- **Append-only**: Add to \`${progressFile}\`, never remove entries
- **Do not edit** \`${taskFile}\` - it's read-only
- **One task only**: Complete exactly one task, then stop
- **Always log progress**: Even on failure, record what happened
- **Do not use** \`git add -A\` - select files manually
- **Signal completion**: When ALL tasks in \`${taskFile}\` are complete, append this EXACT block at the end of \`${progressFile}\`:
----------
${generateDoneMarker(loopId)}

**CRITICAL WARNING**: If you fail to append this completion marker when ALL tasks are done, the Ralph Loop will continue running indefinitely in an infinite loop. You will be trapped in an endless cycle of being spawned repeatedly with no way to exit. The user will have to manually terminate you. DO NOT forget this marker when finished.
`;

    return message;
}

// ─────────────────────────────────────────────
// Main Loop
// ─────────────────────────────────────────────

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
export async function runLoop(client: AntigravityClient, config: LoopConfig): Promise<void> {
    const { taskFile, progressFile, mode, model, maxIterations, stableThreshold, workspaceRoot } = config;
    const loopId = generateLoopId();
    const doneMarker = generateDoneMarker(loopId);
    const progressFilePath = path.join(workspaceRoot, progressFile);
    const state = getState();

    log(`\n${"═".repeat(50)}`);
    log(`🔄 RALPH LOOP BAŞLADI`);
    log(`${"═".repeat(50)}`);
    log(`  Loop ID   : ${loopId}`);
    log(`  Task File : ${taskFile}`);
    log(`  Progress  : ${progressFile}`);
    log(`  Mode      : ${mode}`);
    log(`  Model     : ${model}`);
    log(`  Max Iter  : ${maxIterations}`);
    log(`  Done Mark : ${doneMarker}`);
    log(`${"═".repeat(50)}\n`);

    // Load prompt content once
    let promptContent: string | null = null;
    if (config.promptFile) {
        const promptPath = path.join(workspaceRoot, config.promptFile);
        try {
            promptContent = fs.readFileSync(promptPath, "utf8");
            log(`📄 Prompt yüklendi: ${config.promptFile}`);
        } catch {
            log(`⚠️  Prompt dosyası bulunamadı: ${config.promptFile} (devam ediliyor)`);
        }
    }

    const startTime = Date.now();

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        if (state.stopRequested) {
            log("\n⛔ Kullanıcı tarafından durduruldu.");
            break;
        }

        if (isDoneMarkerPresent(progressFilePath, doneMarker)) {
            log(`\n✅ Done marker bulundu! Tüm tasklar tamamlandı.`);
            break;
        }

        log(`\n${"─".repeat(40)}`);
        log(`▶ İterasyon ${iteration}/${maxIterations}`);
        log(`${"─".repeat(40)}`);

        let cascadeId: string | null = null;
        try {
            // 1. Start cascade
            log("  🚀 Cascade açılıyor...");
            const enablePlanning = mode === "Planning";
            cascadeId = await client.startCascade(enablePlanning);
            log(`  ✓ Cascade: ${cascadeId.substring(0, 12)}...`);

            // 2. Build and send prompt
            const prompt = buildPrompt(config, loopId, promptContent);
            log(`  📤 Prompt gönderiliyor (${prompt.length} karakter)...`);
            await client.sendMessage(cascadeId, prompt, mode, model);
            log("  ✓ Prompt gönderildi");

            // 3. Poll for completion
            log("  ⏳ Agent çalışıyor...");
            await client.pollForCompletion(cascadeId, stableThreshold);

            // 4. Send reminder about done marker
            log("  📋 Done marker hatırlatması gönderiliyor...");
            const reminder = `REMINDER: Before I close this session, verify that you have appended the completion marker "${doneMarker}" to ${progressFile} if ALL tasks in ${taskFile} are complete. If you forgot, add it now or you will be respawned in an infinite loop.`;
            try {
                await client.sendMessageAndWait(cascadeId, reminder, mode, model, stableThreshold);
            } catch {
                // Reminder timeout is OK, continue
            }

            // 5. Delete cascade
            log("  🗑️  Cascade siliniyor...");
            await client.deleteCascade(cascadeId);
            cascadeId = null;

            const elapsed = Math.round((Date.now() - startTime) / 1000);
            log(`  ✓ İterasyon ${iteration} tamamlandı (toplam ${elapsed}s)`);

            await sleep(1000);
        } catch (error) {
            log(`  ❌ Hata: ${(error as Error).message}`);

            if (cascadeId) {
                try {
                    await client.deleteCascade(cascadeId);
                } catch {
                    // Ignore cleanup errors
                }
            }

            log("\n⛔ Hata nedeniyle loop durduruluyor.");
            process.exit(1);
        }
    }

    // Final summary
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;

    log(`\n${"═".repeat(50)}`);
    log(`🏁 RALPH LOOP BİTTİ`);
    log(`  Süre: ${minutes}d ${seconds}s`);

    if (isDoneMarkerPresent(progressFilePath, doneMarker)) {
        log(`  Durum: ✅ Tüm tasklar tamamlandı`);
    } else {
        log(`  Durum: ⚠️  Max iterasyon sınırına ulaşıldı veya durduruldu`);
    }

    log(`${"═".repeat(50)}\n`);
}
