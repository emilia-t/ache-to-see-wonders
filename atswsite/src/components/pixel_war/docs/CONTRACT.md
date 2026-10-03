# pixel_war 前后端契约(TS ↔ Java)

`pixel_war` 的领域模型在两侧各有一份实现,运行时通过协议里的字符串 **tag** 通信:

| 内容 | TypeScript 位置 | Java 位置 |
|---|---|---|
| 技能类与常量 | `class/Skill/Skills/**` | `java/.../game/*Skill.java` |
| 技能注册表 | `registry/SkillRegistry.ts` | `java/.../registry/SkillRegistry.java` |
| 技能 tag 联合类型 | `class/Skill/Skill.ts` 的 `SkillTagType` | ——(以各类 `TAG` 常量为准) |
| 物品定义与物品注册表 | `registry/ItemRegistry.ts` | `java/.../registry/ItemRegistry.java`、`ItemDefinition.java` |
| 实体工厂(快照 → 实体) | `registry/EntityFactory.ts` | `java/.../net/SnapshotBuilder.java` |
| 背包与背包常量 | `class/Inventory/Inventory.ts` | `java/.../game/Inventory.java` |

## 规则

1. **同 tag 必须同名、同文案、同数值**。修改任一侧的 `name` / `description` / `color` / `icon` / `heal` / `cooldown` / `maxStack` 时,必须同步修改另一侧。
2. **新增技能**需要同时:
   - 在 `class/Skill/Skills/<Xxx>/<Xxx>.ts` 新建技能类(含 `static readonly TAG`);
   - 在 `registry/SkillRegistry.ts` 的 `SKILL_REGISTRY` 中登记;
   - 在 `class/Skill/Skill.ts` 的 `SkillTagType` 联合类型中加入该 tag;
   - 在 `java/.../game/<Xxx>.java` 与 `java/.../registry/SkillRegistry.java` 中同步实现。
3. **新增物品**需要在 `registry/ItemRegistry.ts` 与 `java/.../registry/ItemRegistry.java` 中各登记一条定义。

> 所有「tag → 实例 / 定义 / 构造器」的映射都集中在两侧的 `registry/` 目录下:
> TS 为 `src/components/pixel_war/registry/`,Java 为 `top.atsw.pixelwar.registry` 包。

## 校验

```bash
npm run check:contract
```

脚本 `tools/check-contract.mjs`(零依赖)会解析两侧源码并逐字段比对,同时校验:

- 技能注册表 / `SkillTagType` 联合类型 / 各技能类 `TAG` 三者是否一致(防止漏注册);
- 物品单格堆叠上限两侧是否一致。

退出码 `0` 表示契约一致,`1` 表示存在差异或解析失败。建议在提交前以及 CI 中执行。
