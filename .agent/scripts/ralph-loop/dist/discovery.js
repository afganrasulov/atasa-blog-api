/**
 * Antigravity Language Server process discovery.
 *
 * Çalışan LS process'ini bulur, OAuth token'ını çıkarır
 * ve gRPC portunu keşfeder.
 *
 * Discovery sırası:
 * 1. `ps -ax` ile LS process'ini bul → PID, CSRF token
 * 2. `state.vscdb` SQLite dosyasından OAuth token çıkar
 * 3. `lsof` ile TCP portlarını listele
 * 4. Her porta probe gönder → gRPC port'u doğrula
 *
 * @module discovery
 * @packageDocumentation
 */
import http2 from "node:http2";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { ldField } from "./protobuf.js";
import { log } from "./cli.js";
// ─────────────────────────────────────────────
// Workspace ID Helpers
// ─────────────────────────────────────────────
/**
 * Dosya yolunu Antigravity workspace ID formatına çevirir.
 *
 * Antigravity workspace ID'leri özel bir formattadır:
 * `/Users/kent/project` → `file_Users_kent_project`
 *
 * @param filePath - Proje dizin yolu
 * @returns Workspace ID string'i
 *
 * @example
 * ```ts
 * pathToWorkspaceId("/Users/kent/Applications/my-app");
 * // "file_Users_kent_Applications_my-app"
 * ```
 */
export function pathToWorkspaceId(filePath) {
    let normalized = filePath.replace(/\\/g, "/");
    if (normalized.endsWith("/"))
        normalized = normalized.slice(0, -1);
    if (normalized.startsWith("/"))
        normalized = normalized.slice(1);
    return `file_${normalized.replace(/:/g, "_3A").replace(/\//g, "_")}`;
}
/**
 * Workspace ID'yi karşılaştırma için normalize eder.
 *
 * Tire ve alt çizgi farklılıklarını giderir, küçük harfe çevirir.
 *
 * @param id - Normalize edilecek workspace ID
 * @returns Normalize edilmiş ID
 */
export function normalizeId(id) {
    return id.replace(/-/g, "_").toLowerCase();
}
// ─────────────────────────────────────────────
// Process Discovery
// ─────────────────────────────────────────────
/**
 * Antigravity Language Server process'ini bulur.
 *
 * `ps -ax` komutuyla çalışan tüm process'leri tarar.
 * `language_server_macos` veya `language_server` binary'sini,
 * `--app_data_dir antigravity` argümanıyla filtreleyerek bulur.
 *
 * Workspace eşleşmesi yapıldığında:
 * - `--workspace_id` argümanı verilen workspace ile karşılaştırılır
 * - Eşleşme yoksa ilk bulunan process fallback olarak döner
 *
 * @param workspacePath - Eşleştirilecek workspace dizin yolu (opsiyonel)
 * @returns Process bilgileri veya `null` (bulunamazsa)
 */
export function findAntigravityProcess(workspacePath) {
    try {
        const output = execSync("ps -ax -o pid=,command=", {
            encoding: "utf8",
            maxBuffer: 10 * 1024 * 1024,
        });
        const targetWorkspaceId = workspacePath
            ? pathToWorkspaceId(workspacePath)
            : null;
        let fallback = null;
        for (const line of output.split("\n")) {
            const isLS = line.includes("language_server_macos") ||
                line.includes("language_server");
            const isAG = line.includes("--app_data_dir antigravity") ||
                line.toLowerCase().includes("/antigravity/");
            if (isLS && isAG) {
                const pidMatch = line.trim().match(/^(\d+)/);
                const pid = pidMatch ? parseInt(pidMatch[1], 10) : 0;
                const csrfMatch = line.match(/--csrf_token\s+([a-f0-9-]+)/i);
                const csrfToken = csrfMatch ? csrfMatch[1] : null;
                const portMatch = line.match(/--extension_server_port\s+(\d+)/);
                const extensionServerPort = portMatch
                    ? parseInt(portMatch[1], 10)
                    : undefined;
                const wsMatch = line.match(/--workspace_id\s+(\S+)/);
                const workspaceId = wsMatch ? wsMatch[1] : undefined;
                if (csrfToken) {
                    const info = { pid, csrfToken, extensionServerPort, workspaceId };
                    if (targetWorkspaceId) {
                        if (normalizeId(workspaceId || "") ===
                            normalizeId(targetWorkspaceId)) {
                            return info;
                        }
                        if (!fallback)
                            fallback = info;
                    }
                    else {
                        return info;
                    }
                }
            }
        }
        return fallback;
    }
    catch {
        return null;
    }
}
// ─────────────────────────────────────────────
// Token Extraction
// ─────────────────────────────────────────────
/**
 * Antigravity'nin local storage'ından OAuth token çıkarır.
 *
 * `state.vscdb` SQLite dosyasının binary içeriğinde
 * `ya29.` prefix'li Google OAuth access token'ı arar.
 *
 * Aranan dosya konumları (sırasıyla):
 * 1. `~/Library/Application Support/Antigravity/User/globalStorage/state.vscdb` (macOS)
 * 2. `~/Library/Application Support/Antigravity/User/state.vscdb` (macOS alternatif)
 * 3. `~/.config/Antigravity/User/globalStorage/state.vscdb` (Linux)
 *
 * @returns OAuth access token veya `null`
 */
export function extractOAuthToken() {
    const homeDir = os.homedir();
    const possiblePaths = [
        path.join(homeDir, "Library", "Application Support", "Antigravity", "User", "globalStorage", "state.vscdb"),
        path.join(homeDir, "Library", "Application Support", "Antigravity", "User", "state.vscdb"),
        path.join(homeDir, ".config", "Antigravity", "User", "globalStorage", "state.vscdb"),
    ];
    for (const dbPath of possiblePaths) {
        try {
            if (fs.existsSync(dbPath)) {
                const content = fs.readFileSync(dbPath);
                const contentStr = content.toString("utf8");
                const tokenMatch = contentStr.match(/ya29\.[A-Za-z0-9_-]{50,}/);
                if (tokenMatch)
                    return tokenMatch[0];
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
// ─────────────────────────────────────────────
// Port Discovery
// ─────────────────────────────────────────────
/**
 * Bir process'in dinlediği TCP portlarını listeler.
 *
 * `lsof` komutuyla process'in LISTEN durumundaki TCP soketlerini alır.
 *
 * @param pid - Process ID
 * @returns Dinlenen port numaralarının dizisi
 */
export function getListeningPorts(pid) {
    try {
        const output = execSync(`lsof -nP -iTCP -sTCP:LISTEN -p ${pid}`, {
            encoding: "utf8",
            maxBuffer: 10 * 1024 * 1024,
        });
        const ports = [];
        for (const line of output.split("\n")) {
            if (line.includes("TCP") && line.includes("LISTEN")) {
                const portMatch = line.match(/:(\d+)\s*\(LISTEN\)/);
                if (portMatch) {
                    const port = parseInt(portMatch[1], 10);
                    if (!ports.includes(port))
                        ports.push(port);
                }
            }
        }
        return ports;
    }
    catch {
        return [];
    }
}
/**
 * Bir port'un Antigravity gRPC-Web protokolü konuşup konuşmadığını test eder.
 *
 * `GetUnleashData` RPC'sine minimal bir istek gönderir.
 * 200 dönerse port doğrulanır.
 *
 * @param port - Test edilecek port numarası
 * @param csrfToken - CSRF token
 * @returns `true` eğer port gRPC-Web konuşuyorsa
 */
export function probeGrpcPort(port, csrfToken) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        try {
            const client = http2.connect(`https://127.0.0.1:${port}`, {
                rejectUnauthorized: false,
            });
            client.on("error", () => {
                clearTimeout(timeout);
                client.close();
                resolve(false);
            });
            client.on("connect", () => {
                const metadata = Buffer.concat([
                    ldField(1, "antigravity"),
                    ldField(4, "en"),
                ]);
                const payload = ldField(1, metadata);
                const req = client.request({
                    ":method": "POST",
                    ":path": "/exa.language_server_pb.LanguageServerService/GetUnleashData",
                    "content-type": "application/proto",
                    "connect-protocol-version": "1",
                    "x-codeium-csrf-token": csrfToken || "",
                    "content-length": payload.length.toString(),
                });
                req.on("response", (headers) => {
                    clearTimeout(timeout);
                    client.close();
                    resolve(headers[":status"] === 200);
                });
                req.on("error", () => {
                    clearTimeout(timeout);
                    client.close();
                    resolve(false);
                });
                req.write(payload);
                req.end();
            });
        }
        catch {
            clearTimeout(timeout);
            resolve(false);
        }
    });
}
// ─────────────────────────────────────────────
// Full Discovery
// ─────────────────────────────────────────────
/**
 * Tam discovery akışı: process bul, token çıkar, port keşfet.
 *
 * Bu fonksiyon sırasıyla:
 * 1. {@link findAntigravityProcess} ile LS process'ini bulur
 * 2. {@link extractOAuthToken} ile OAuth token'ını çıkarır
 * 3. {@link getListeningPorts} ile portları listeler
 * 4. {@link probeGrpcPort} ile gRPC portunu doğrular
 *
 * @param workspacePath - Workspace dizin yolu
 * @returns Bağlantı konfigürasyonu
 * @throws Herhangi bir adım başarısız olursa
 *
 * @example
 * ```ts
 * const config = await discover("/Users/kent/Applications/my-app");
 * console.log(config.port); // 52849
 * ```
 */
export async function discover(workspacePath) {
    log("🔍 Antigravity process aranıyor...");
    const processInfo = findAntigravityProcess(workspacePath);
    if (!processInfo) {
        throw new Error("Antigravity process bulunamadı. Antigravity açık mı?");
    }
    log(`  ✓ PID: ${processInfo.pid}`);
    log(`  ✓ CSRF: ${processInfo.csrfToken.substring(0, 8)}...`);
    if (processInfo.workspaceId) {
        log(`  ✓ Workspace: ${processInfo.workspaceId}`);
    }
    log("🔍 OAuth token çıkarılıyor...");
    const oauthToken = extractOAuthToken();
    if (!oauthToken) {
        throw new Error("OAuth token bulunamadı. Antigravity'ye giriş yapılmış mı?");
    }
    log(`  ✓ Token: ${oauthToken.substring(0, 12)}...`);
    log("🔍 gRPC portu keşfediliyor...");
    const ports = getListeningPorts(processInfo.pid);
    if (ports.length === 0) {
        throw new Error("Dinlenen port bulunamadı.");
    }
    log(`  → ${ports.length} port bulundu: ${ports.join(", ")}`);
    let grpcPort = null;
    for (const port of ports) {
        const isGrpc = await probeGrpcPort(port, processInfo.csrfToken);
        if (isGrpc) {
            grpcPort = port;
            break;
        }
    }
    if (!grpcPort) {
        throw new Error("gRPC portu doğrulanamadı.");
    }
    log(`  ✓ gRPC Port: ${grpcPort}`);
    return {
        port: grpcPort,
        csrfToken: processInfo.csrfToken,
        oauthToken,
    };
}
//# sourceMappingURL=discovery.js.map