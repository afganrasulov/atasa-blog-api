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
/**
 * Model ismi → Antigravity proto enum ID eşleştirmesi.
 *
 * ID'ler `MODEL_PLACEHOLDER_M{N}` formatındadır:
 * - ID < 1000: Doğrudan enum değeri (örn. 333, 334, 342)
 * - ID >= 1000: 1000 + suffix (örn. 1026 = M26)
 *
 * @example
 * ```ts
 * const id = MODEL_IDS["Claude Opus 4.6 (Thinking)"]; // 1026
 * ```
 */
export declare const MODEL_IDS: Record<ModelName, number>;
/**
 * Varsayılan model.
 *
 * CLI'da `--model` argümanı verilmezse bu model kullanılır.
 */
export declare const DEFAULT_MODEL: ModelName;
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
export declare function encodeVarint(value: number): Buffer;
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
export declare function ldField(tag: number, data: string | Buffer): Buffer;
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
export declare function frame(data: Buffer, isEndOfStream?: boolean): Buffer;
/**
 * Antigravity API çağrıları için metadata protobuf payload'u oluşturur.
 *
 * LS her RPC'de IDE bilgileri + OAuth token içeren metadata bekler.
 *
 * @param oauthToken - Google OAuth access token (`ya29.` prefix)
 * @param extensionVersion - Extension sürümü
 * @returns Encoded metadata Buffer
 */
export declare function buildMetadata(oauthToken: string, extensionVersion?: string): Buffer;
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
export declare function buildSafetyConfig(modelName: ModelName): Buffer;
//# sourceMappingURL=protobuf.d.ts.map