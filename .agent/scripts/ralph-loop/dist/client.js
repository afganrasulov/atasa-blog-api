/**
 * Antigravity Language Server gRPC-Web client.
 *
 * HTTP/2 üzerinden ConnectRPC (v1) binary protocol ile
 * Antigravity LS'e bağlanır ve cascade (agent session) yönetir.
 *
 * Desteklenen RPC'ler:
 * - `StartCascade` — Yeni agent session'ı başlatır
 * - `SendUserCascadeMessage` — Agent'a prompt gönderir
 * - `GetCascadeTrajectorySteps` — Agent'ın durumunu sorgular
 * - `CancelCascadeInvocation` — Çalışan agent'ı iptal eder
 * - `DeleteCascadeTrajectory` — Session'ı siler
 *
 * @module client
 * @packageDocumentation
 */
import http2 from "node:http2";
import { ldField, buildMetadata, buildSafetyConfig } from "./protobuf.js";
import { DEFAULT_MODEL } from "./protobuf.js";
import { log, sleep, getState } from "./cli.js";
/** LS RPC base path */
const RPC_BASE = "/exa.language_server_pb.LanguageServerService";
/**
 * Antigravity Language Server client.
 *
 * HTTP/2 TLS bağlantısı üzerinden ConnectRPC binary protocol ile iletişim kurar.
 * Tüm I/O Promise-based async/await pattern ile yapılır.
 *
 * @example
 * ```ts
 * const client = new AntigravityClient(config);
 * await client.connect();
 *
 * const cascadeId = await client.startCascade();
 * await client.sendMessage(cascadeId, "Hello, world!");
 * await client.pollForCompletion(cascadeId);
 *
 * client.disconnect();
 * ```
 */
export class AntigravityClient {
    /** Bağlantı konfigürasyonu */
    config;
    /** HTTP/2 client session */
    client;
    /**
     * Yeni client instance oluşturur.
     *
     * @param config - {@link ClientConfig} — port, CSRF token, OAuth token
     */
    constructor(config) {
        this.config = config;
        this.client = null;
    }
    /**
     * Antigravity LS'e HTTP/2 TLS bağlantısı açar.
     *
     * Self-signed certificate'ı kabul eder (`rejectUnauthorized: false`).
     * Bağlantı 5 saniye içinde kurulmazsa timeout hatası fırlatır.
     *
     * @throws Bağlantı hatası veya timeout
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.client = http2.connect(`https://127.0.0.1:${this.config.port}`, { rejectUnauthorized: false });
            let connected = false;
            this.client.on("connect", () => {
                connected = true;
                resolve();
            });
            this.client.on("error", (err) => reject(err));
            setTimeout(() => {
                if (!connected)
                    reject(new Error("Bağlantı zaman aşımı (5s)"));
            }, 5000);
        });
    }
    /**
     * HTTP/2 bağlantısını kapatır.
     *
     * Birden fazla kez çağrılabilir — güvenlidir.
     */
    disconnect() {
        if (this.client) {
            this.client.close();
            this.client = null;
        }
    }
    /**
     * RPC request header'larını oluşturur.
     *
     * @param rpcPath - RPC metod adı (örn. `StartCascade`)
     * @param payloadLength - Request body uzunluğu
     * @returns HTTP/2 header object
     */
    makeHeaders(rpcPath, payloadLength) {
        return {
            ":method": "POST",
            ":path": `${RPC_BASE}/${rpcPath}`,
            "content-type": "application/proto",
            "connect-protocol-version": "1",
            origin: "vscode-file://vscode-app",
            "x-codeium-csrf-token": this.config.csrfToken,
            ...(payloadLength !== undefined && {
                "content-length": payloadLength.toString(),
            }),
        };
    }
    /**
     * Yeni cascade (agent session) başlatır.
     *
     * Cascade, Antigravity'nin otonom agent session'ıdır.
     * Bir cascade içinde birden fazla mesaj gönderilebilir.
     *
     * @param enablePlanning - Planning modu aktif mi
     * @returns Cascade UUID
     * @throws RPC hatası
     *
     * @example
     * ```ts
     * const cascadeId = await client.startCascade(false);
     * // cascadeId = "3009d942-591e-4a1b-..."
     * ```
     */
    async startCascade(enablePlanning = false) {
        if (!this.client)
            throw new Error("Bağlantı yok");
        const metadata = buildMetadata(this.config.oauthToken);
        const payload = Buffer.concat([
            ldField(1, metadata),
            Buffer.from([0x20, enablePlanning ? 0x01 : 0x00]),
        ]);
        return new Promise((resolve, reject) => {
            const req = this.client.request(this.makeHeaders("StartCascade", payload.length));
            let responseData = Buffer.alloc(0);
            req.on("response", (headers) => {
                if (headers[":status"] !== 200) {
                    reject(new Error(`StartCascade failed: status ${headers[":status"]}`));
                }
            });
            req.on("data", (chunk) => {
                responseData = Buffer.concat([responseData, chunk]);
            });
            req.on("end", () => {
                if (responseData.length > 2) {
                    const len = responseData[1];
                    const cascadeId = responseData
                        .subarray(2, 2 + len)
                        .toString("utf8");
                    resolve(cascadeId);
                    return;
                }
                reject(new Error("StartCascade: boş yanıt"));
            });
            req.on("error", reject);
            req.write(payload);
            req.end();
        });
    }
    /**
     * Cascade'e kullanıcı mesajı gönderir.
     *
     * Agent'ın çalıştırılacağı prompt'u ve model seçimini içerir.
     * Bu çağrı mesajı kuyruğa koyar — agent hemen çalışmaya başlar.
     *
     * @param cascadeId - Hedef cascade UUID
     * @param message - Agent'a gönderilecek prompt
     * @param mode - Çalışma modu
     * @param modelName - Kullanılacak model
     * @throws RPC hatası
     */
    async sendMessage(cascadeId, message, mode = "Fast", modelName = DEFAULT_MODEL) {
        if (!this.client)
            throw new Error("Bağlantı yok");
        const messageBody = ldField(1, message);
        const planningMode = mode === "Planning" ? 1 : 0;
        const modeField = Buffer.from([0x70, planningMode]);
        const safetyConfig = buildSafetyConfig(modelName);
        const payload = Buffer.concat([
            ldField(1, cascadeId),
            ldField(2, messageBody),
            ldField(3, buildMetadata(this.config.oauthToken)),
            safetyConfig,
            modeField,
        ]);
        return new Promise((resolve, reject) => {
            const req = this.client.request(this.makeHeaders("SendUserCascadeMessage", payload.length));
            req.on("response", (headers) => {
                if (headers[":status"] === 200) {
                    resolve();
                    return;
                }
                reject(new Error(`SendMessage failed: status ${headers[":status"]}`));
            });
            req.on("error", reject);
            req.write(payload);
            req.end();
        });
    }
    /**
     * Agent'ın tamamlanmasını bekler (polling).
     *
     * `GetCascadeTrajectorySteps` RPC'sini 2 saniyede bir çağırır.
     * Response body boyutu {@link LoopConfig.stableThreshold} kadar ardışık
     * poll'da değişmezse "agent tamamlandı" kabul edilir.
     *
     * @param cascadeId - İzlenecek cascade UUID
     * @param stableThreshold - Tamamlanma için gereken ardışık stabil poll sayısı
     * @throws Kullanıcı durdurursa veya bağlantı hatası
     */
    async pollForCompletion(cascadeId, stableThreshold = 7) {
        if (!this.client)
            throw new Error("Bağlantı yok");
        const pollIntervalMs = 2000;
        let lastContentLen = 0;
        let stableCount = 0;
        let hasGrown = false;
        const startTime = Date.now();
        const state = getState();
        while (true) {
            if (state.stopRequested) {
                throw new Error("Kullanıcı tarafından durduruldu");
            }
            const payload = ldField(1, cascadeId);
            const result = await new Promise((resolve, reject) => {
                const req = this.client.request(this.makeHeaders("GetCascadeTrajectorySteps", payload.length));
                let responseData = Buffer.alloc(0);
                req.on("data", (chunk) => {
                    responseData = Buffer.concat([responseData, chunk]);
                });
                req.on("response", (headers) => {
                    req.on("end", () => resolve({ status: headers[":status"], data: responseData }));
                });
                req.on("error", reject);
                req.write(payload);
                req.end();
            });
            if (result.status !== 200) {
                await sleep(pollIntervalMs);
                continue;
            }
            const raw = result.data.toString("utf8");
            const text = raw.replace(/[^\x20-\x7E\n\r\t]/g, "");
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const contentGrew = text.length > lastContentLen;
            if (contentGrew) {
                hasGrown = true;
                stableCount = 0;
                if (state.verbose) {
                    log(`  [${elapsed}s] İçerik büyüyor: ${lastContentLen} → ${text.length}`);
                }
            }
            else if (hasGrown) {
                stableCount++;
                if (state.verbose) {
                    log(`  [${elapsed}s] Stabil (${stableCount}/${stableThreshold})`);
                }
                if (stableCount >= stableThreshold) {
                    log(`  ✓ Agent tamamlandı (${(stableCount * pollIntervalMs) / 1000}s stabil)`);
                    return;
                }
            }
            else {
                if (state.verbose) {
                    log(`  [${elapsed}s] Agent başlamasını bekliyor (len=${text.length})`);
                }
            }
            lastContentLen = text.length;
            await sleep(pollIntervalMs);
        }
    }
    /**
     * Mesaj gönderir ve tamamlanmasını bekler.
     *
     * {@link sendMessage} + {@link pollForCompletion} birleşimi.
     *
     * @param cascadeId - Cascade UUID
     * @param message - Gönderilecek mesaj
     * @param mode - Çalışma modu
     * @param model - Model ismi
     * @param stableThreshold - Tamamlanma hassasiyeti
     */
    async sendMessageAndWait(cascadeId, message, mode = "Fast", model = DEFAULT_MODEL, stableThreshold = 7) {
        await this.sendMessage(cascadeId, message, mode, model);
        await this.pollForCompletion(cascadeId, stableThreshold);
    }
    /**
     * Çalışan cascade'i iptal eder.
     *
     * Agent'ın mevcut çalışmasını durdurur ama session'ı silmez.
     *
     * @param cascadeId - İptal edilecek cascade UUID
     */
    async cancelCascade(cascadeId) {
        if (!this.client)
            return;
        const payload = ldField(1, cascadeId);
        return new Promise((resolve, reject) => {
            const req = this.client.request(this.makeHeaders("CancelCascadeInvocation", payload.length));
            req.on("response", (headers) => {
                headers[":status"] === 200
                    ? resolve()
                    : reject(new Error(`Cancel failed: ${headers[":status"]}`));
            });
            req.on("error", reject);
            req.write(payload);
            req.end();
        });
    }
    /**
     * Cascade ve tüm trajectory'sini kalıcı olarak siler.
     *
     * Iterasyon sonunda session temizliği için kullanılır.
     *
     * @param cascadeId - Silinecek cascade UUID
     */
    async deleteCascade(cascadeId) {
        if (!this.client)
            return;
        const payload = ldField(1, cascadeId);
        return new Promise((resolve, reject) => {
            const req = this.client.request(this.makeHeaders("DeleteCascadeTrajectory", payload.length));
            req.on("response", (headers) => {
                headers[":status"] === 200
                    ? resolve()
                    : reject(new Error(`Delete failed: ${headers[":status"]}`));
            });
            req.on("error", reject);
            req.write(payload);
            req.end();
        });
    }
}
//# sourceMappingURL=client.js.map