import { Entity } from '@/components/pixel_war/class/Entity/Entity';
import { EmptyEntity } from '@/components/pixel_war/class/Entity/EmptyEntity/EmptyEntity';
// 静态实体
import { WallStaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/WallStaticEntity/WallStaticEntity';
import { BoxStaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/BoxStaticEntity/BoxStaticEntity';
import { CurbStaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/CurbStaticEntity/CurbStaticEntity';
import { CurbStaticEntity8Length } from '@/components/pixel_war/class/Entity/StaticEntity/CurbStaticEntity/CurbStaticEntity8Length/CurbStaticEntity8Length';
// 物品实体
import { HealingGemItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/FoodItemEntity/HealingGemItemEntity/HealingGemItemEntity';
// NPC 实体
import { WhitePixelEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/WhitePixelEntity/WhitePixelEntity';
import { WhitePixelVa2Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/WhitePixelEntity/WhitePixelVa2Entity/WhitePixelVa2Entity';
import { RedPixelEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/RedPixelEntity/RedPixelEntity';
import { GoldenDodgeXa4Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/GoldenDodgeXa4Entity/GoldenDodgeXa4Entity';
import { PurpleFireworkOa18Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/PurpleFireworkOa18Entity/PurpleFireworkOa18Entity';
import { OnahauLoneLs1Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/OnahauLoneLs1Entity/OnahauLoneLs1Entity';
import { CoralRedTentacleT1Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/CoralRedTentacleT1Entity/CoralRedTentacleT1Entity';
import { AmberTurretAt7Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/AmberTurretAt7Entity/AmberTurretAt7Entity';
import { MagentaSwarmSw5Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/MagentaSwarmSw5Entity/MagentaSwarmSw5Entity';
import { TitaniumPrismTp9Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/TitaniumPrismTp9Entity/TitaniumPrismTp9Entity';
import { CobaltBouncerCb6Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/CobaltBouncerCb6Entity/CobaltBouncerCb6Entity';
import { IvoryWandererIw1Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NeutralNpcDynamicEntity/IvoryWandererIw1Entity/IvoryWandererIw1Entity';
import { AmethystDrifterAd5Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NeutralNpcDynamicEntity/AmethystDrifterAd5Entity/AmethystDrifterAd5Entity';
import { CeladonMenderCm9Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/CeladonMenderCm9Entity/CeladonMenderCm9Entity';
import { SkyBluePixelEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/SkyBluePixelEntity/SkyBluePixelEntity';
import { PurpleShieldEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/PurpleShieldEntity/PurpleShieldEntity';
import { RoseBeaconRb7Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/RoseBeaconRb7Entity/RoseBeaconRb7Entity';
import { SaltSentinelSs2Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/SaltSentinelSs2Entity/SaltSentinelSs2Entity';
import { AshenBoomerangAh3Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/AshenBoomerangAh3Entity/AshenBoomerangAh3Entity';
import { VerdantLancerVl4Entity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/VerdantLancerVl4Entity/VerdantLancerVl4Entity';
// 玩家与弹体
import { PlayerDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/PlayerDynamicEntity/PlayerDynamicEntity';
import { OrdinaryBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/OrdinaryBulletDynamicEntity/OrdinaryBulletDynamicEntity';
import { LaserBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/LaserBulletDynamicEntity/LaserBulletDynamicEntity';
import { SniperBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/SniperBulletDynamicEntity/SniperBulletDynamicEntity';
import { BuckshotBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BuckshotBulletDynamicEntity/BuckshotBulletDynamicEntity';
import { SpiralBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/SpiralBulletDynamicEntity/SpiralBulletDynamicEntity';
import { PiercingBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/PiercingBulletDynamicEntity/PiercingBulletDynamicEntity';
import { RicochetBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/RicochetBulletDynamicEntity/RicochetBulletDynamicEntity';
import { AcceleratingBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/AcceleratingBulletDynamicEntity/AcceleratingBulletDynamicEntity';
import { BoomerangBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BoomerangBulletDynamicEntity/BoomerangBulletDynamicEntity';
import { WaveBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/WaveBulletDynamicEntity/WaveBulletDynamicEntity';
import { RedPixelBombEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/GrenadeDynamicEntity/RedPixelBombEntity/RedPixelBombEntity';
// 掉落物
import { ExpOrbDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/ExpOrbDynamicEntity/ExpOrbDynamicEntity';
import { SkillOrbDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/SkillOrbDynamicEntity/SkillOrbDynamicEntity';
import { BulletOrbDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletOrbDynamicEntity/BulletOrbDynamicEntity';
import type { BulletTag, DynamicEntityKind } from '@/components/pixel_war/type/Type';
import type { Point } from '@/components/pixel_war/interface/Interface';

/**
 * 实体工厂(实体注册表的一种形式):服务端快照 -> 可渲染实体。
 *
 * 这里集中了"快照 type/kind/tag -> 具体实体构造器"的全部映射,
 * 原先散落在 ViewPixelWar.vue 内(约 100 行的 if/else + switch)。
 *
 * 新增实体时:在下方对应分支登记即可,渲染层无需改动。
 */

/**
 * 从快照的 velocity 推导单位方向向量
 */
const H_getBulletDirectionFromSnapshot = (snapshot: any): Point => {
  const velocity = snapshot.velocity || { x: 1, y: 0 };
  const len = Math.hypot(velocity.x, velocity.y);
  if (len < 0.0001) return { x: 1, y: 0 };
  return {
    x: velocity.x / len,
    y: velocity.y / len,
  };
};

/**
 * 从快照的 velocity 推导子弹速度大小(px/s)。
 *
 * 多人快照不携带子弹速度常量,而拖尾长度按速度缩放(见 BulletDynamicEntity.getTrailSpeedScale),
 * 因此这里用 velocity 的模长还原速度;缺失或非法时返回 undefined,由实体构造器回退到默认速度。
 */
const H_getBulletSpeedFromSnapshot = (snapshot: any): number | undefined => {
  const velocity = snapshot.velocity;
  if (!velocity) return undefined;
  const speed = Math.hypot(velocity.x ?? 0, velocity.y ?? 0);
  return Number.isFinite(speed) && speed > 0 ? speed : undefined;
};

/**
 * 依据服务端快照创建对应的客户端实体
 * @param snapshot 服务端下发的实体快照
 * @returns 新建的实体,无法识别时返回 EmptyEntity 兜底
 */
const H_createEntityFromSnapshot = (snapshot: any): Entity => {
  // 静态实体
  if (snapshot.type === 'static') {
    const tag = snapshot.tag;
    switch (tag) {
      case 'wall':
        return new WallStaticEntity(snapshot.position, snapshot.name, tag);
      case 'curb':
        return new CurbStaticEntity(snapshot.position, snapshot.name, tag);
      case 'curb8':
        return new CurbStaticEntity8Length(snapshot.position, snapshot.direction);
      case 'box':
        return new BoxStaticEntity(snapshot.position, snapshot.name, tag);
    }
  }
  // 物体实体
  if (snapshot.type === 'item') {
    const tag = snapshot.tag;
    switch (tag) {
      case 'healing_gem':
        return new HealingGemItemEntity(snapshot.position, snapshot.name, tag);
    }
  }
  // 动态实体
  const kind = snapshot.kind as DynamicEntityKind;
  if (kind === 'npc') {
    const tag = snapshot.tag;
    switch (tag){
      case 'white_pixel':
        return new WhitePixelEntity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'white_pixel_va2':
        return new WhitePixelVa2Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'red_pixel':
        return new RedPixelEntity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'sky_blue_pixel':
        return new SkyBluePixelEntity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'purple_shield':
        return new PurpleShieldEntity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'golden_dodge_xa4':
        return new GoldenDodgeXa4Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'purple_firework_oa18':
        return new PurpleFireworkOa18Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'onahau_lone_ls1':
        return new OnahauLoneLs1Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'coral_red_tentacle_t1':
        return new CoralRedTentacleT1Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'amber_turret_at7':
        return new AmberTurretAt7Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'magenta_swarm_sw5':
        return new MagentaSwarmSw5Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'titanium_prism_tp9':
        return new TitaniumPrismTp9Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'cobalt_bouncer_cb6':
        return new CobaltBouncerCb6Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'salt_sentinel_ss2':
        return new SaltSentinelSs2Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'ashen_boomerang_ah3':
        return new AshenBoomerangAh3Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'verdant_lancer_vl4':
        return new VerdantLancerVl4Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'amethyst_drifter_ad5':
        return new AmethystDrifterAd5Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'rose_beacon_rb7':
        return new RoseBeaconRb7Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'ivory_wanderer_iw1':
        return new IvoryWandererIw1Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'celadon_mender_cm9':
        return new CeladonMenderCm9Entity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
    }
  }
  else if(kind === 'player'){
    return new PlayerDynamicEntity(snapshot.position, snapshot.name, snapshot.isme);
  }
  else if(kind === 'bullet'){
    const bulletTag = snapshot.tag as BulletTag;
    switch(bulletTag){
      case 'ordinary_bullet':
        return new OrdinaryBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name,
          snapshot.bulletColor
        );
      case 'laser_bullet':
        return new LaserBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name,
          snapshot.bulletColor ?? '',
          {
            // 激光的配置随时间不变,快照会随每次下发携带,水合时会覆盖这些字段
            length: snapshot.laserMaxLength,
            expandSpeed: snapshot.laserExpandSpeed,
            durationTicks: snapshot.laserHoldSeconds !== undefined
              ? snapshot.laserHoldSeconds / LaserBulletDynamicEntity.TICK_SECONDS
              : undefined,
            glowColor: snapshot.laserGlowColor
          }
        );
      case 'sniper_bullet':
        return new SniperBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name
        );
      case 'buckshot_bullet':
        return new BuckshotBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name
        );
      case 'spiral_bullet':
        return new SpiralBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name
        );
      case 'piercing_bullet':
        return new PiercingBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name
        );
      case 'ricochet_bullet':
        return new RicochetBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name
        );
      case 'accelerating_bullet':
        return new AcceleratingBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name,
          H_getBulletSpeedFromSnapshot(snapshot)
        );
      case 'boomerang_bullet':
        return new BoomerangBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name,
          H_getBulletSpeedFromSnapshot(snapshot)
        );
      case 'wave_bullet':
        return new WaveBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name,
          H_getBulletSpeedFromSnapshot(snapshot)
        );
    }
  }
  else if(kind === 'exp_orb'){
    return new ExpOrbDynamicEntity(snapshot.position, snapshot.value);
  }
  else if(kind === 'skill_orb'){
    return new SkillOrbDynamicEntity(snapshot.position, snapshot.skillTag);
  }
  else if(kind === 'bullet_orb'){
    return new BulletOrbDynamicEntity(snapshot.position, snapshot.value);
  }
  else{//grenade
    const grenadeTag = snapshot.tag;
    switch (grenadeTag){
      case 'red_pixel_bomb':{
        return new RedPixelBombEntity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      }
    }
  }
  return new EmptyEntity();
};

export { H_createEntityFromSnapshot, H_getBulletDirectionFromSnapshot };
