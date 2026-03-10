#!/usr/bin/env node

/**
 * Ralph Loop CLI — Entry Point
 *
 * Antigravity'nin internal gRPC-Web API'sini kullanarak
 * otonom iteratif AI coding loop çalıştırır.
 *
 * Reverse-engineered from Antigravity Language Server'ın
 * ConnectRPC v1 binary protocol'ü.
 *
 * ## Mimariye Genel Bakış
 *
 * ```
 * CLI (index.ts)
 *  └── parseArgs() → LoopConfig
 *  └── discover()  → ClientConfig (PID, CSRF, OAuth, port)
 *  └── AntigravityClient
 *       └── startCascade()
 *       └── sendMessage()
 *       └── pollForCompletion()
 *  └── runLoop()   → iteratif agent çalıştırma
 * ```
 *
 * ## Modüller
 *
 * | Modül | Sorumluluk |
 * |-------|------------|
 * | `types.ts` | Interface/type tanımları |
 * | `protobuf.ts` | Protobuf encoding + model config |
 * | `discovery.ts` | LS process/token/port keşfi |
 * | `client.ts` | gRPC-Web HTTP/2 client |
 * | `engine.ts` | Loop orchestration |
 * | `cli.ts` | Argüman parsing + utilities |
 *
 * @example
 * ```bash
 * # Build
 * npm run build
 *
 * # Dry run (bağlantı testi)
 * node dist/index.js --dry-run
 *
 * # Full run
 * node dist/index.js --task TASKS.md --max-iterations 10
 *
 * # Claude Opus ile planlama modunda
 * node dist/index.js --model "Claude Opus 4.6 (Thinking)" --mode Planning
 * ```
 *
 * @packageDocumentation
 */

import fs from "node:fs";
import path from "node:path";

import { parseArgs, log, getState } from "./cli.js";
import { discover } from "./discovery.js";
import { AntigravityClient } from "./client.js";
import { runLoop } from "./engine.js";

// Re-export all modules for TypeDoc
export * from "./types.js";
export * from "./protobuf.js";
export * from "./discovery.js";
export * from "./client.js";
export * from "./engine.js";
export { log, sleep, parseArgs, printHelp, getState } from "./cli.js";

/**
 * Ana giriş noktası.
 *
 * Sıralı akış:
 * 1. CLI argümanlarını parse et
 * 2. Workspace ve task dosyasını doğrula
 * 3. Antigravity LS discovery (PID, CSRF, OAuth, port)
 * 4. gRPC-Web bağlantısı kur
 * 5. Iteratif loop çalıştır
 * 6. Temizlik ve çıkış
 */
async function main(): Promise<void> {
    const config = parseArgs();
    const state = getState();

    console.log(`
  ╔══════════════════════════════════════╗
  ║       🔄 RALPH LOOP CLI v2.0        ║
  ║   Standalone Antigravity Agent (TS)  ║
  ╚══════════════════════════════════════╝
  `);

    // Handle SIGINT (Ctrl+C)
    process.on("SIGINT", () => {
        log("\n🛑 Ctrl+C algılandı. Güvenli kapatma...");
        state.stopRequested = true;
        setTimeout(() => {
            log("⛔ Zorla kapatılıyor.");
            process.exit(130);
        }, 3000);
    });

    // Validate workspace
    if (!fs.existsSync(config.workspaceRoot)) {
        log(`❌ Workspace bulunamadı: ${config.workspaceRoot}`);
        process.exit(1);
    }

    // Validate task file
    const taskFilePath = path.join(config.workspaceRoot, config.taskFile);
    if (!fs.existsSync(taskFilePath)) {
        log(`❌ Task dosyası bulunamadı: ${taskFilePath}`);
        process.exit(1);
    }

    try {
        // Discovery
        const credentials = await discover(config.workspaceRoot);

        if (config.dryRun) {
            log("\n✅ Dry run tamamlandı. Her şey hazır!");
            log(`  Port  : ${credentials.port}`);
            log(`  CSRF  : ${credentials.csrfToken.substring(0, 8)}...`);
            log(`  OAuth : ${credentials.oauthToken.substring(0, 12)}...`);
            process.exit(0);
        }

        // Connect
        log("\n🔌 Antigravity'ye bağlanılıyor...");
        const client = new AntigravityClient(credentials);
        await client.connect();
        log("  ✓ Bağlantı kuruldu");

        // Run loop
        await runLoop(client, config);

        // Cleanup
        client.disconnect();
        log("👋 Bağlantı kapatıldı.");
    } catch (error) {
        log(`\n❌ Fatal hata: ${(error as Error).message}`);
        if (state.verbose) console.error(error);
        process.exit(1);
    }
}

main();
