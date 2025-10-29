// The relative position of this file: src/class/Tool.ts
export default class Tool {
    /**
     * 生成格式为 'YYYY-MM-DD HH:mm:ss:SSS' 的时间字符串
     * @param date 可选，Date对象，默认为当前时间
     * @returns 格式化的时间字符串
     */
    public static getFormatTime(date: Date = new Date()): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const u = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        const c = String(date.getMilliseconds()).padStart(3, '0');
        
        return `${y}-${m}-${d} ${h}:${u}:${s}:${c}`;
    }

    /**
     * 获取当前时间戳（毫秒）
     * @returns 当前时间戳
     */
    public static getTimestamp(): number {
        return Date.now();
    }

    /**
     * 解析格式为 'YYYY-MM-DD HH:mm:ss:SSS' 的时间字符串为时间戳（毫秒）
     * @param timeString 时间字符串
     * @returns 时间戳（毫秒数），解析失败返回 NaN
     */
    public static formatTime2Timestamp(timeString: string): number {
        try {
            const regex = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}):(\d{3})$/;
            const match = timeString.match(regex);
            if (!match) {
                throw new Error('Invalid time string format');
            }
            const [, y, m, d, h, u, s, c] = match;
            const date = new Date(
                parseInt(y),
                parseInt(m) - 1,
                parseInt(d),
                parseInt(h),
                parseInt(u),
                parseInt(s),
                parseInt(c)
            );
            return date.getTime();
        } catch (error) {
            console.error('Failed to parse time string:', error);
            return NaN;
        }
    }

    /**
     * 将时间戳转换为格式化的时间字符串
     * @param timestamp 时间戳（毫秒）
     * @returns 格式化的时间字符串
     */
    public static timestamp2FormatTime(timestamp: number): string {
        return Tool.getFormatTime(new Date(timestamp));
    }

    /**
     * 计算两个时间字符串之间的时间差（毫秒）
     * @param startTime 开始时间字符串
     * @param endTime 结束时间字符串，默认为当前时间
     * @returns 时间差（毫秒），计算失败返回 NaN
     */
    public static formatTimeMinusFormatTime(
        startTime: string, 
        endTime: string = Tool.getFormatTime()
    ): number {
        const startTimestamp = Tool.formatTime2Timestamp(startTime);
        const endTimestamp = Tool.formatTime2Timestamp(endTime);
        if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
            return NaN;
        }
        return endTimestamp - startTimestamp;
    }

    /**
     * 使用RSA公钥加密字符串
     * @param plainText 要加密的明文
     * @param publicKey 公钥字符串
     * @returns 加密后的base64字符串
     */
    public static async rsaEncrypt(plainText: string, publicKey: string): Promise<string> {
        try {
            const key = await Tool.importPublicKey(publicKey);
            const encoder = new TextEncoder();
            const data = encoder.encode(plainText);
            const encrypted = await crypto.subtle.encrypt(
                {name: "RSA-OAEP"},
                key,
                data
            );
            return Tool.arrayBufferToBase64(encrypted);
        } catch (error) {
            console.error('RSA encryption failed:', error);
            throw new Error('RSA encryption failed');
        }
    }

    /**
     * 使用RSA私钥解密字符串
     * @param encryptedText 加密的base64字符串
     * @param privateKey 私钥字符串
     * @returns 解密后的明文
     */
    public static async rsaDecrypt(encryptedText: string, privateKey: string): Promise<string>{
        try {
            const key = await Tool.importPrivateKey(privateKey);
            const encryptedData = Tool.base64ToArrayBuffer(encryptedText);
            const decrypted = await crypto.subtle.decrypt(
                {name: "RSA-OAEP"},
                key,
                encryptedData
            );
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('RSA decryption failed:', error);
            throw new Error('RSA decryption failed');
        }
    }

    /**
     * 导入RSA公钥
     * @param pem 公钥PEM格式字符串
     * @returns CryptoKey对象
     */
    private static async importPublicKey(pem: string): Promise<CryptoKey> {
        const pemContents = pem
            .replace(/-----BEGIN PUBLIC KEY-----/, '')
            .replace(/-----END PUBLIC KEY-----/, '')
            .replace(/\s/g, '');
        const binaryDer = Tool.base64ToArrayBuffer(pemContents);
        return await crypto.subtle.importKey(
            "spki",
            binaryDer,
            {name: "RSA-OAEP",hash: "SHA-256"},
            true,
            ["encrypt"]
        );
    }

    /**
     * 导入RSA私钥
     * @param pem 私钥PEM格式字符串
     * @returns CryptoKey对象
     */
    private static async importPrivateKey(pem: string): Promise<CryptoKey> {
        const pemContents = pem
            .replace(/-----BEGIN PRIVATE KEY-----/, '')
            .replace(/-----END PRIVATE KEY-----/, '')
            .replace(/\s/g, '');
        const binaryDer = Tool.base64ToArrayBuffer(pemContents);
        return await crypto.subtle.importKey(
            "pkcs8",
            binaryDer,
            {name: "RSA-OAEP",hash: "SHA-256"},
            true,
            ["decrypt"]
        );
    }

    /**
     * 将base64字符串转换为ArrayBuffer
     * @param base64 base64字符串
     * @returns ArrayBuffer
     */
    private static base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * 将ArrayBuffer转换为base64字符串
     * @param buffer ArrayBuffer
     * @returns base64字符串
     */
    private static arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}