/**
 * Protobuf encoding helpers ve model konfigürasyonu.
 *
 * Antigravity LS'in ConnectRPC API'si protobuf binary format kullanır.
 * Bu modül, protobuf field/frame encoding ve model seçim payload'larını oluşturur.
 *
 * @module protobuf
 * @packageDocumentation
 */

import type { ModelName } from "./types.js";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/**
 * Model ismi → Antigravity proto enum ID eşleştirmesi.
 *
 * **Kaynak:** `hegemonikon` GitHub reposu →
 * `mekhane/ochema/docs/ls-standalone-reference.md`
 *
 * ID pattern'leri:
 * - ID < 1000: Doğrudan proto enum değeri (örn. 333, 334, 342)
 * - ID >= 1000: `MODEL_PLACEHOLDER_M{N}` → 1000 + N (örn. M26 → 1026)
 *
 * **Güncelleme:** Yeni model eklendiğinde yukarıdaki kaynak dosyayı kontrol et.
 * Detaylı bilgi için `MODELS.md` dosyasına bak.
 *
 * @see {@link ../MODELS.md} — Model ID referans dokümanı
 *
 * @example
 * ```ts
 * const id = MODEL_IDS["Claude Opus 4.6 (Thinking)"]; // 1026
 * ```
 */
export const MODEL_IDS: Record<ModelName, number> = {
    "Gemini 3 Flash": 1018,
    "Gemini 3 Pro (Low)": 1007,
    "Gemini 3 Pro (High)": 1008,
    "Claude Sonnet 4.5": 333,
    "Claude Sonnet 4.5 (Thinking)": 334,
    "Claude Opus 4.6 (Thinking)": 1026,
    "GPT-OSS-120B (Medium)": 342,
};

/**
 * Varsayılan model.
 *
 * CLI'da `--model` argümanı verilmezse bu model kullanılır.
 */
export const DEFAULT_MODEL: ModelName = "Claude Opus 4.6 (Thinking)";

// ─────────────────────────────────────────────
// Encoding Functions
// ─────────────────────────────────────────────

/**
 * Unsigned integer'ı protobuf varint formatına encode eder.
 *
 * Varint her byte'ın 7 bit data + 1 bit continuation flag içerdiği
 * variable-length encoding formatıdır.
 *
 * @param value - Encode edilecek pozitif tam sayı
 * @returns Varint olarak encode edilmiş Buffer
 *
 * @example
 * ```ts
 * encodeVarint(1026); // Buffer<82 08>
 * encodeVarint(150);  // Buffer<96 01>
 * ```
 */
export function encodeVarint(value: number): Buffer {
    const bytes: number[] = [];
    while (value > 0x7f) {
        bytes.push((value & 0x7f) | 0x80);
        value >>= 7;
    }
    bytes.push(value & 0x7f);
    return Buffer.from(bytes);
}

/**
 * Length-delimited protobuf field oluşturur.
 *
 * Protobuf wire type 2 (length-delimited) formatında field header + data birleştirir.
 * String veya Buffer kabul eder.
 *
 * @param tag - Protobuf field numarası (1-indexed)
 * @param data - Field değeri (string veya Buffer)
 * @returns Wire-format encoded protobuf field
 *
 * @example
 * ```ts
 * // Field 1 = "hello"
 * ldField(1, "hello");
 * // Field 3 = binary data
 * ldField(3, Buffer.from([0x01, 0x02]));
 * ```
 */
export function ldField(tag: number, data: string | Buffer): Buffer {
    const tagByte = (tag << 3) | 2;
    const body = typeof data === "string" ? Buffer.from(data) : data;
    const len = body.length;
    const lenBytes: number[] = [];

    if (len < 128) {
        lenBytes.push(len);
    } else if (len < 16384) {
        lenBytes.push((len & 0x7f) | 0x80);
        lenBytes.push(len >> 7);
    } else {
        let remaining = len;
        while (remaining >= 128) {
            lenBytes.push((remaining & 0x7f) | 0x80);
            remaining >>= 7;
        }
        lenBytes.push(remaining);
    }

    return Buffer.concat([Buffer.from([tagByte]), Buffer.from(lenBytes), body]);
}

/**
 * ConnectRPC protocol frame oluşturur.
 *
 * 5-byte header (flags + length) + payload formatında frame.
 * Antigravity LS ConnectRPC (v1) binary protocol kullanır.
 *
 * @param data - Frame payload
 * @param isEndOfStream - Son frame mi (flag 0x02)
 * @returns Framed data
 */
export function frame(data: Buffer, isEndOfStream = false): Buffer {
    const header = Buffer.alloc(5);
    header.writeUInt8(isEndOfStream ? 0x02 : 0x00, 0);
    header.writeUInt32BE(data.length, 1);
    return Buffer.concat([header, data]);
}

/**
 * Antigravity API çağrıları için metadata protobuf payload'u oluşturur.
 *
 * LS her RPC'de IDE bilgileri + OAuth token içeren metadata bekler.
 *
 * @param oauthToken - Google OAuth access token (`ya29.` prefix)
 * @param extensionVersion - Extension sürümü
 * @returns Encoded metadata Buffer
 */
export function buildMetadata(
    oauthToken: string,
    extensionVersion = "1.14.2",
): Buffer {
    return Buffer.concat([
        ldField(1, "antigravity"),
        ldField(3, oauthToken),
        ldField(4, "en"),
        ldField(7, extensionVersion),
        ldField(12, "antigravity"),
    ]);
}

/**
 * Model seçimi içeren safety config payload'u oluşturur.
 *
 * `SendUserCascadeMessage` RPC'sine gönderilen cascade config protobuf'unun
 * model seçim kısmını oluşturur.
 *
 * Safety config, izin verilen komutları ve model ID'yi içerir.
 * Hex-encoded kısımlar reverse-engineer edilmiş sabit değerlerdir.
 *
 * @param modelName - Kullanılacak model ismi
 * @returns Encoded safety config Buffer (field 5 wrapper dahil)
 *
 * @example
 * ```ts
 * const config = buildSafetyConfig("Claude Opus 4.6 (Thinking)");
 * // → protobuf field 5 (safety_config) with model ID 1026
 * ```
 */
export function buildSafetyConfig(modelName: ModelName): Buffer {
    const modelId = MODEL_IDS[modelName] || MODEL_IDS["Gemini 3 Flash"];
    const modelIdVarint = encodeVarint(modelId);
    const modelField = Buffer.concat([Buffer.from([0x08]), modelIdVarint]);
    const field15 = Buffer.concat([
        Buffer.from([0x7a]),
        Buffer.from([modelField.length]),
        modelField,
    ]);

    // Reverse-engineered safety config (allowed commands + permissions)
    const beforeModel = Buffer.from(
        "0a631204200170006a4c42451a43120275761a07676974206164641a096769742073746173681a096769742072657365741a0c67697420636865636b6f75741a09707974686f6e202d631a0370697030038a02020801",
        "hex",
    );
    const afterModel = Buffer.from(
        "aa0102080182020208013a0208015801",
        "hex",
    );

    const innerContent = Buffer.concat([beforeModel, field15, afterModel]);
    return Buffer.concat([
        Buffer.from([0x2a]),
        encodeVarint(innerContent.length),
        innerContent,
    ]);
}
