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
export * from "./types.js";
export * from "./protobuf.js";
export * from "./discovery.js";
export * from "./client.js";
export * from "./engine.js";
export { log, sleep, parseArgs, printHelp, getState } from "./cli.js";
//# sourceMappingURL=index.d.ts.map