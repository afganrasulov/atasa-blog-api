/**
 * Ralph Loop CLI — Type definitions
 *
 * Tüm interface, type ve enum tanımları.
 * Projede kullanılan her veri yapısı burada tanımlanır.
 *
 * @module types
 * @packageDocumentation
 */
/**
 * Desteklenen AI model isimleri.
 *
 * Her model, Antigravity'nin proto enum'unda bir ID'ye karşılık gelir.
 * Pattern: `MODEL_PLACEHOLDER_M{N}` → ID = 1000 + N
 *
 * @example
 * ```ts
 * const model: ModelName = "Claude Opus 4.6 (Thinking)";
 * ```
 */
export type ModelName = "Gemini 3 Flash" | "Gemini 3 Pro (Low)" | "Gemini 3 Pro (High)" | "Claude Sonnet 4.5" | "Claude Sonnet 4.5 (Thinking)" | "Claude Opus 4.6 (Thinking)" | "GPT-OSS-120B (Medium)";
/**
 * Cascade çalışma modu.
 *
 * - `Fast`: Hızlı mod — planning aşaması atlanır
 * - `Planning`: Planlama modu — agent önce plan yapar, sonra çalışır
 */
export type CascadeMode = "Fast" | "Planning";
/**
 * Antigravity LS process bilgileri.
 *
 * `ps -ax` çıktısından parse edilen process metadata'sı.
 */
export interface ProcessInfo {
    /** Process ID */
    pid: number;
    /** CSRF token — LS'e her request'te gönderilmeli */
    csrfToken: string;
    /** Extension server port (opsiyonel) */
    extensionServerPort?: number;
    /** Workspace ID — `file_Users_kent_Applications_project` formatında */
    workspaceId?: string;
}
/**
 * Antigravity LS'e bağlanmak için gereken kimlik bilgileri.
 *
 * {@link discover} fonksiyonu tarafından döndürülür.
 */
export interface ClientConfig {
    /** gRPC-Web port numarası (HTTPS) */
    port: number;
    /** CSRF token */
    csrfToken: string;
    /** Google OAuth access token (`ya29.` prefix'li) */
    oauthToken: string;
}
/**
 * Ralph Loop çalışma konfigürasyonu.
 *
 * CLI argümanlarından parse edilir. {@link parseArgs} fonksiyonu tarafından oluşturulur.
 */
export interface LoopConfig {
    /** Proje kök dizini */
    workspaceRoot: string;
    /** Task listesi dosyası (TASKS.md) */
    taskFile: string;
    /** İlerleme kayıt dosyası */
    progressFile: string;
    /** System prompt dosyası (AGENT.md) */
    promptFile: string;
    /** Cascade çalışma modu */
    mode: CascadeMode;
    /** Kullanılacak AI model */
    model: ModelName;
    /** Maksimum iterasyon sayısı */
    maxIterations: number;
    /**
     * Agent tamamlanma algılama hassasiyeti.
     *
     * Content boyutu bu kadar ardışık poll'da değişmezse
     * agent tamamlandı kabul edilir. Her poll 2 saniyedir.
     *
     * @defaultValue 7
     */
    stableThreshold: number;
    /** Sadece discovery yap, loop çalıştırma */
    dryRun: boolean;
}
/**
 * gRPC poll sonucu.
 *
 * `GetCascadeTrajectorySteps` RPC'sinin ham yanıtı.
 */
export interface PollResult {
    /** HTTP/2 status kodu */
    status: number;
    /** Yanıt body'si (protobuf binary) */
    data: Buffer;
}
/**
 * Genel durum bilgisi.
 *
 * Modüller arası global state. Sinyal handling için kullanılır.
 */
export interface RuntimeState {
    /** Detaylı log aktif mi */
    verbose: boolean;
    /** Ctrl+C ile durdurma istendi mi */
    stopRequested: boolean;
}
//# sourceMappingURL=types.d.ts.map