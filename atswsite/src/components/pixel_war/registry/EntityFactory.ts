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
import { SkyBluePixelEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/SkyBluePixelEntity/SkyBluePixelEntity';
import { PurpleShieldEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/PurpleShieldEntity/PurpleShieldEntity';
// 玩家与弹体
import { PlayerDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/PlayerDynamicEntity/PlayerDynamicEntity';
import { OrdinaryBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/OrdinaryBulletDynamicEntity/OrdinaryBulletDynamicEntity';
import { LaserBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/LaserBulletDynamicEntity/LaserBulletDynamicEntity';
import { SniperBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/SniperBulletDynamicEntity/SniperBulletDynamicEntity';
import { BuckshotBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BuckshotBulletDynamicEntity/BuckshotBulletDynamicEntity';
import { RedPixelBombEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/GrenadeDynamicEntity/RedPixelBombEntity/RedPixelBombEntity';
// 掉落物
import { ExpOrbDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/ExpOrbDynamicEntity/ExpOrbDynamicEntity';
import { SkillOrbDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/SkillOrbDynamicEntity/SkillOrbDynamicEntity';
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
          snapshot.name
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
    }
  }
  else if(kind === 'exp_orb'){
    return new ExpOrbDynamicEntity(snapshot.position, snapshot.value);
  }
  else if(kind === 'skill_orb'){
    return new SkillOrbDynamicEntity(snapshot.position, snapshot.skillTag);
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
