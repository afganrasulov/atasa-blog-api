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
import type { ProcessInfo, ClientConfig } from "./types.js";
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
export declare function pathToWorkspaceId(filePath: string): string;
/**
 * Workspace ID'yi karşılaştırma için normalize eder.
 *
 * Tire ve alt çizgi farklılıklarını giderir, küçük harfe çevirir.
 *
 * @param id - Normalize edilecek workspace ID
 * @returns Normalize edilmiş ID
 */
export declare function normalizeId(id: string): string;
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
export declare function findAntigravityProcess(workspacePath?: string): ProcessInfo | null;
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
export declare function extractOAuthToken(): string | null;
/**
 * Bir process'in dinlediği TCP portlarını listeler.
 *
 * `lsof` komutuyla process'in LISTEN durumundaki TCP soketlerini alır.
 *
 * @param pid - Process ID
 * @returns Dinlenen port numaralarının dizisi
 */
export declare function getListeningPorts(pid: number): number[];
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
export declare function probeGrpcPort(port: number, csrfToken: string): Promise<boolean>;
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
export declare function discover(workspacePath: string): Promise<ClientConfig>;
//# sourceMappingURL=discovery.d.ts.map