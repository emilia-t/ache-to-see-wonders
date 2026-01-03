// The relative position of this file: src/class/recreation_hall_3d/VideoTextureManager.ts
// Code name:RH3
import * as THREE from 'three';

export interface VideoAspectRatio {
  width: number;
  height: number;
  ratio: number;
}

export class VideoTextureManager {
  private videoElement: HTMLVideoElement | null = null;
  private videoTexture: THREE.VideoTexture | null = null;
  private isPlaying: boolean = false;
  private currentVideoUrl: string | null = null;
  
  // 视频播放控制相关
  private playPromise: Promise<void> | null = null;
  private onPlayCallback: ((isPlaying: boolean) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private onMetadataLoadedCallback: ((aspectRatio: VideoAspectRatio) => void) | null = null;

  // 视频元数据
  private videoWidth: number = 0;
  private videoHeight: number = 0;
  private videoAspectRatio: number = 0;

  /**
   * 创建视频纹理
   */
  public createVideoTexture(videoUrl: string): THREE.VideoTexture {
    // 如果已经有视频元素，先清理
    this.dispose();
    
    // 创建视频元素
    this.videoElement = document.createElement('video');
    this.videoElement.crossOrigin = 'anonymous';
    this.videoElement.loop = true;
    this.videoElement.muted = false; // 默认不静音，用户可以控制
    this.videoElement.preload = 'auto';
    this.videoElement.playsInline = true;
    
    // 添加视频事件监听
    this.videoElement.addEventListener('ended', this.handleVideoEnded.bind(this));
    this.videoElement.addEventListener('play', this.handleVideoPlay.bind(this));
    this.videoElement.addEventListener('pause', this.handleVideoPause.bind(this));
    
    // 监听元数据加载完成
    this.videoElement.addEventListener('loadedmetadata', this.handleMetadataLoaded.bind(this));
    
    // 设置视频源
    this.videoElement.src = videoUrl;
    this.currentVideoUrl = videoUrl;
    
    // 创建Three.js视频纹理
    this.videoTexture = new THREE.VideoTexture(this.videoElement);
    this.videoTexture.flipY = false;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.format = THREE.RGBFormat;
    
    return this.videoTexture;
  }
  /**
   * 获取视频宽高比
   */
  public getVideoAspectRatio(): VideoAspectRatio {
    return {
      width: this.videoWidth,
      height: this.videoHeight,
      ratio: this.videoAspectRatio
    };
  }

  /**
   * 设置元数据加载回调
   */
  public setOnMetadataLoadedCallback(callback: (aspectRatio: VideoAspectRatio) => void): void {
    this.onMetadataLoadedCallback = callback;
  }

  /**
   * 计算视频纹理的UV变换以保持宽高比
   */
  public calculateUVTransform(screenAspectRatio: number): {
    offset: THREE.Vector2;
    repeat: THREE.Vector2;
  } {
    if (!this.videoElement || this.videoAspectRatio === 0) {
      return {
        offset: new THREE.Vector2(0, 0),
        repeat: new THREE.Vector2(1, 1)
      };
    }
    
    const videoAspect = this.videoAspectRatio;
    const screenAspect = screenAspectRatio;
    
    let offsetX = 0;
    let offsetY = 0;
    let repeatX = 1;
    let repeatY = 1;
    
    if (videoAspect > screenAspect) {
      // 视频比屏幕宽 - 保持宽度，裁剪左右
      repeatY = 1;
      repeatX = screenAspect / videoAspect;
      offsetX = (1 - repeatX) / 2;
      offsetY = 0;
    } else {
      // 视频比屏幕高 - 保持高度，裁剪上下
      repeatX = 1;
      repeatY = videoAspect / screenAspect;
      offsetX = 0;
      offsetY = (1 - repeatY) / 2;
    }
    
    console.log(`视频宽高比: ${videoAspect.toFixed(2)}, 屏幕宽高比: ${screenAspect.toFixed(2)}`);
    console.log(`纹理变换 - 重复: (${repeatX.toFixed(2)}, ${repeatY.toFixed(2)}), 偏移: (${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})`);
    
    return {
      offset: new THREE.Vector2(offsetX, offsetY),
      repeat: new THREE.Vector2(repeatX, repeatY)
    };
  }

  /**
   * 应用UV变换到纹理
   */
  public applyUVTransformToTexture(transform: { offset: THREE.Vector2; repeat: THREE.Vector2 }): void {
    if (!this.videoTexture) return;
    
    this.videoTexture.offset.copy(transform.offset);
    this.videoTexture.repeat.copy(transform.repeat);
    this.videoTexture.needsUpdate = true;
  }

  /**
   * 处理元数据加载
   */
  private handleMetadataLoaded(): void {
    if (!this.videoElement) return;
    
    this.videoWidth = this.videoElement.videoWidth;
    this.videoHeight = this.videoElement.videoHeight;
    this.videoAspectRatio = this.videoWidth / this.videoHeight;
    
    console.log(`视频元数据加载完成: ${this.videoWidth}x${this.videoHeight}, 宽高比: ${this.videoAspectRatio.toFixed(2)}`);
    
    if (this.onMetadataLoadedCallback) {
      this.onMetadataLoadedCallback({
        width: this.videoWidth,
        height: this.videoHeight,
        ratio: this.videoAspectRatio
      });
    }
  }
  /**
   * 播放视频
   */
  public async play(): Promise<void> {
    if (!this.videoElement) return;
    
    try {
      this.playPromise = this.videoElement.play();
      await this.playPromise;
      this.isPlaying = true;
      
      if (this.onPlayCallback) {
        this.onPlayCallback(true);
      }
    } catch (error) {
      console.error('播放视频失败:', error);
    }
  }

  /**
   * 暂停视频
   */
  public pause(): void {
    if (!this.videoElement) return;
    
    this.videoElement.pause();
    this.isPlaying = false;
    
    if (this.onPlayCallback) {
      this.onPlayCallback(false);
    }
  }

  /**
   * 停止视频
   */
  public stop(): void {
    if (!this.videoElement) return;
    
    this.pause();
    this.videoElement.currentTime = 0;
  }

  /**
   * 设置音量
   */
  public setVolume(volume: number): void {
    if (!this.videoElement) return;
    this.videoElement.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * 切换静音
   */
  public toggleMute(): boolean {
    if (!this.videoElement) return false;
    
    this.videoElement.muted = !this.videoElement.muted;
    return this.videoElement.muted;
  }

  /**
   * 跳转到指定时间
   */
  public seekTo(time: number): void {
    if (!this.videoElement) return;
    
    if (time >= 0 && time <= this.videoElement.duration) {
      this.videoElement.currentTime = time;
    }
  }

  /**
   * 更新视频源
   */
  public updateVideoSource(videoUrl: string, keepCurrentTime: boolean = false): void {
    if (!this.videoElement) return;
    
    // 检查是否是相同的视频源
    if (this.currentVideoUrl === videoUrl) {
      console.log('视频源未改变，跳过更新');
      return;
    }
    
    // 保存当前状态
    const wasPlaying = this.isPlaying;
    const currentTime = this.videoElement.currentTime;
    
    // 暂停视频（但不重置时间）
    if (wasPlaying) {
      this.videoElement.pause();
    }
    
    // 设置新的视频源
    this.videoElement.src = videoUrl;
    this.currentVideoUrl = videoUrl;
    this.videoElement.load();
    
    // 监听新视频的加载完成事件
    const onCanPlay = () => {
      // 恢复之前的时间位置
      if (keepCurrentTime && currentTime > 0) {
        this.videoElement!.currentTime = currentTime;
      }
      
      // 如果之前正在播放，则继续播放
      if (wasPlaying) {
        this.play().catch(error => {
          console.warn('恢复播放失败:', error);
        });
      }
      
      // 移除事件监听
      this.videoElement!.removeEventListener('canplay', onCanPlay);
    };
    
    this.videoElement.addEventListener('canplay', onCanPlay);
    
    console.log(`视频源已更新: ${videoUrl}`);
  }

  /**
   * 继续播放视频（从当前时间继续）
   */
  public async resume(): Promise<void> {
    if (!this.videoElement) return;
    
    try {
      this.playPromise = this.videoElement.play();
      await this.playPromise;
      this.isPlaying = true;
      
      if (this.onPlayCallback) {
        this.onPlayCallback(true);
      }
      console.log('视频继续播放');
    } catch (error) {
      console.error('继续播放视频失败:', error);
    }
  }

  /**
   * 获取视频状态
   */
  public getVideoStatus(): {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
  } {
    if (!this.videoElement) {
      return {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 0,
        muted: true
      };
    }
    
    return {
      isPlaying: this.isPlaying,
      currentTime: this.videoElement.currentTime,
      duration: this.videoElement.duration || 0,
      volume: this.videoElement.volume,
      muted: this.videoElement.muted
    };
  }

  /**
   * 设置播放状态回调
   */
  public setOnPlayCallback(callback: (isPlaying: boolean) => void): void {
    this.onPlayCallback = callback;
  }

  /**
   * 设置播放结束回调
   */
  public setOnEndCallback(callback: () => void): void {
    this.onEndCallback = callback;
  }

  /**
   * 视频结束处理
   */
  private handleVideoEnded(): void {
    this.isPlaying = false;
    
    if (this.onEndCallback) {
      this.onEndCallback();
    }
    
    if (this.onPlayCallback) {
      this.onPlayCallback(false);
    }
  }

  /**
   * 视频开始播放处理
   */
  private handleVideoPlay(): void {
    this.isPlaying = true;
    
    if (this.onPlayCallback) {
      this.onPlayCallback(true);
    }
  }

  /**
   * 视频暂停处理
   */
  private handleVideoPause(): void {
    this.isPlaying = false;
    
    if (this.onPlayCallback) {
      this.onPlayCallback(false);
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement.remove();
      this.videoElement = null;
    }
    
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
    
    this.isPlaying = false;
    this.currentVideoUrl = null;
    this.playPromise = null;
  }
}