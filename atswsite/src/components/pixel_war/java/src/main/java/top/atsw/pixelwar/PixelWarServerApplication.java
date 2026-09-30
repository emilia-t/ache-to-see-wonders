package top.atsw.pixelwar;

import top.atsw.pixelwar.config.PixelWarProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * pixel_war 多人对局服务端入口。
 *
 * <p>本服务端由前端 TypeScript 版权威模拟(service/Service.ts 及其依赖的实体/背包/技能模块)
 * 迁移而来,用于多人游戏;前端单人模式仍使用浏览器内的 Web Worker 版本。</p>
 */
@SpringBootApplication
@EnableConfigurationProperties(PixelWarProperties.class)
@EnableScheduling
public class PixelWarServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(PixelWarServerApplication.class, args);
    }
}
