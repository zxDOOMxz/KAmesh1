export interface Compressor {
  compress(data: Uint8Array): Promise<Uint8Array>
  decompress(data: Uint8Array): Promise<Uint8Array>
}

// zstd level 3 — best ratio/speed for text
// Native module binding
export declare function zstdCompress(data: Uint8Array, level: number): Promise<Uint8Array>
export declare function zstdDecompress(data: Uint8Array): Promise<Uint8Array>
