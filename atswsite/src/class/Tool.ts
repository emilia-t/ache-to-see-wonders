// The relative position of this file: src/class/Tool.ts
export default class Tool {
    public static defaultHeadImgCache = new Map<string,string>();//头像缓存
    // 常见图片格式扩展名
    public static imageExtensions = [
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 
        'ico', 'tiff', 'tif', 'avif', 'heic', 'heif'
    ];
        
    // 常见图片 MIME 类型
    public static imageMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'image/bmp', 'image/webp', 'image/svg+xml', 'image/x-icon',
        'image/tiff', 'image/avif', 'image/heic', 'image/heif'
    ];
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

    /**
     * 根据用户名生成默认头像
     * @param {string} username - 用户名
     * @param {number} size - 头像尺寸，默认100px
     * @returns {string} - 返回base64格式的头像图片
     */
    private static createDefaultHeadImg(username: string, size: number = 100): string {
        // 创建canvas元素
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return '';
        
        // 如果用户名为空，使用默认字符
        const displayChar = username && username.length > 0 
            ? username.charAt(0).toUpperCase() 
            : '?';
        
        // 创建渐变背景 - 深绿色到浅绿色（左上到右下）
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#1b5e20');  // 深绿色
        gradient.addColorStop(0.5, '#2e7d32'); // 中等绿色
        gradient.addColorStop(1, '#4caf50');  // 浅绿色
        
        // 绘制圆形背景
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // 添加微妙的阴影效果
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 绘制文字
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${size * 0.45}px 'Microsoft YaHei', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 添加文字阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        // 向下偏移
        ctx.fillText(displayChar, size / 2, size / 2 + 4);
        
        // 重置阴影
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        return canvas.toDataURL('image/png');
    }

    /**
     * 获取用户头像URL（支持缓存）
     * @param {string} username - 用户名
     * @param {number} size - 头像尺寸
     * @returns {string} - 头像URL
     */
    public static getDefaultHeadImg(username: string, size: number = 100): string {
        const cacheKey = `${username}_${size}`;
        if (this.defaultHeadImgCache.has(cacheKey)) {
            return this.defaultHeadImgCache.get(cacheKey)!;
        }
        const avatar = this.createDefaultHeadImg(username, size);
        this.defaultHeadImgCache.set(cacheKey, avatar);
        return avatar;
    }

    /**
     * 检测一个字符串是否是图像的资源链接
     * @param str 
     */
    public static isImgURI(str: string): boolean {
        if (typeof str !== 'string') return false;
        try {
            // 检查是否是 Data URL（base64 图片）
            if (str.startsWith('data:image/')) {
                const mimeType = str.split(';')[0].split(':')[1];
                return this.imageMimeTypes.includes(mimeType);
            }
            // 检查是否是 URL
            const url = new URL(str);
            const pathname = url.pathname.toLowerCase();
            const extension = pathname.split('.').pop() as string;
            
            return this.imageExtensions.includes(extension);
        } catch {
            // 如果不是有效的 URL，检查是否是相对路径
            const extension = str.split('.').pop() as string;
            return this.imageExtensions.includes(extension);
        }
    }

    /**
     * 检测两点之间的距离和角度(与x轴相交)弧度制
     * @param str 
     */
    public static calculateDistanceAndAngle(x1:number,y1:number,x2:number,y2:number) {
        // 计算两点在x轴和y轴上的差值
        const dx = x2 - x1;
        const dy = y2 - y1;
        
        // 计算两点之间的距离（欧几里得距离）
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 计算线段AB与x轴的夹角（使用Math.atan2，结果在[-π, π]之间）
        const angle = Math.atan2(dy, dx);
    
        return {
            distance: distance,
            angle: angle
        };
    }
    /**
     * 逆时针旋转角度
     * @param angleA 被旋转角度值
     * @param angleB 旋转角度值
     */
    public static adjustAngle(angleA: number, angleB: number): number {
        let result = angleA + angleB;
        result = (result + Math.PI) % (2 * Math.PI);
        return result <= 0 ? result + Math.PI : result - Math.PI;
    }
}