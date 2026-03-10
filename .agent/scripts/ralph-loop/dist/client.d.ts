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
import type { ClientConfig, ModelName, CascadeMode } from "./types.js";
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
export declare class AntigravityClient {
    /** Bağlantı konfigürasyonu */
    private config;
    /** HTTP/2 client session */
    private client;
    /**
     * Yeni client instance oluşturur.
     *
     * @param config - {@link ClientConfig} — port, CSRF token, OAuth token
     */
    constructor(config: ClientConfig);
    /**
     * Antigravity LS'e HTTP/2 TLS bağlantısı açar.
     *
     * Self-signed certificate'ı kabul eder (`rejectUnauthorized: false`).
     * Bağlantı 5 saniye içinde kurulmazsa timeout hatası fırlatır.
     *
     * @throws Bağlantı hatası veya timeout
     */
    connect(): Promise<void>;
    /**
     * HTTP/2 bağlantısını kapatır.
     *
     * Birden fazla kez çağrılabilir — güvenlidir.
     */
    disconnect(): void;
    /**
     * RPC request header'larını oluşturur.
     *
     * @param rpcPath - RPC metod adı (örn. `StartCascade`)
     * @param payloadLength - Request body uzunluğu
     * @returns HTTP/2 header object
     */
    private makeHeaders;
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
    startCascade(enablePlanning?: boolean): Promise<string>;
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
    sendMessage(cascadeId: string, message: string, mode?: CascadeMode, modelName?: ModelName): Promise<void>;
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
    pollForCompletion(cascadeId: string, stableThreshold?: number): Promise<void>;
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
    sendMessageAndWait(cascadeId: string, message: string, mode?: CascadeMode, model?: ModelName, stableThreshold?: number): Promise<void>;
    /**
     * Çalışan cascade'i iptal eder.
     *
     * Agent'ın mevcut çalışmasını durdurur ama session'ı silmez.
     *
     * @param cascadeId - İptal edilecek cascade UUID
     */
    cancelCascade(cascadeId: string): Promise<void>;
    /**
     * Cascade ve tüm trajectory'sini kalıcı olarak siler.
     *
     * Iterasyon sonunda session temizliği için kullanılır.
     *
     * @param cascadeId - Silinecek cascade UUID
     */
    deleteCascade(cascadeId: string): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map