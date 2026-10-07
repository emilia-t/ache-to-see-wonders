#!/usr/bin/env node
/**
 * TS ↔ Java 契约校验(零依赖,直接 node 运行)
 *
 * 背景:pixel_war 的领域模型在两侧各有一份实现——
 *   - TS:  registry/SkillRegistry.ts、registry/ItemRegistry.ts、class/Skill/**
 *   - Java:java/.../registry/**、java/.../game/**
 * 两侧通过协议中的字符串 tag 通信,任何一方的 tag / 文案 / 数值被单独修改都会造成
 * "客户端显示"与"服务端判定"不一致(历史上就出现过物品恢复量两侧不同的问题)。
 *
 * 本脚本按源码文本提取两侧的注册表元数据并逐字段比对:
 *   1. 物品(ItemDefinition):tag / name / description / color / icon / heal / maxStack
 *   2. 技能(Skill):          tag / name / shortName / description / color / cooldown / icon / trigger
 *   3. 注册表完整性:技能注册表、SkillTagType 联合类型、各技能类 TAG 三者必须一致
 *   4. 实体(Entity):        同图类的静态常量(同名或 PLAYER_ 前缀对应)、tag、战利品表
 *   5. NPC 生成权重:        TS SPAWNABLE_NPC_CLASSES ↔ Java World.createRandomNpc 权重阶梯
 *
 * 名称归一化约定:TS 类名去 DynamicEntity/Entity 后缀,Java 去 Npc/Entity 后缀
 * (如 OnahauLoneLs1Entity ↔ OnahauLoneLs1Npc、LaserBulletDynamicEntity ↔ LaserBulletEntity)。
 *
 * 用法:node src/components/pixel_war/tools/check-contract.mjs
 * 退出码:0 = 契约一致;1 = 存在差异或解析失败
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..'); // → pixel_war/

const TS_SKILL_ROOT = path.join(ROOT, 'class/Skill');
const TS_SKILLS_DIR = path.join(TS_SKILL_ROOT, 'Skills');
const TS_SKILL_BASE = path.join(TS_SKILL_ROOT, 'Skill.ts');
const TS_INVENTORY = path.join(ROOT, 'class/Inventory/Inventory.ts');
const TS_SKILL_REGISTRY = path.join(ROOT, 'registry/SkillRegistry.ts');
const TS_ITEM_REGISTRY = path.join(ROOT, 'registry/ItemRegistry.ts');

const JAVA_ROOT = path.join(ROOT, 'java/src/main/java/top/atsw/pixelwar');
const JAVA_GAME_DIR = path.join(JAVA_ROOT, 'game');
const JAVA_REGISTRY_DIR = path.join(JAVA_ROOT, 'registry');
const JAVA_ITEM_REGISTRY = path.join(JAVA_REGISTRY_DIR, 'ItemRegistry.java');
const JAVA_SKILL_REGISTRY = path.join(JAVA_REGISTRY_DIR, 'SkillRegistry.java');
/** 物品单格堆叠上限常量仍在 Inventory.java 中声明,注册表引用它 */
const JAVA_INVENTORY = path.join(JAVA_GAME_DIR, 'Inventory.java');

const problems = [];
const notes = [];

/** 读取文件(UTF-8);缺失即视为致命问题 */
function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`缺少必需文件:${path.relative(ROOT, file)}`);
  }
  return fs.readFileSync(file, 'utf8');
}

/** 递归列出目录下的文件 */
function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** 取 `keyword(...)` 的括号内文本(从首次出现处开始做括号配对) */
function extractCallArgs(source, keyword) {
  const start = source.indexOf(`${keyword}(`);
  if (start < 0) return null;
  let i = start + keyword.length + 1;
  let depth = 1;
  const begin = i;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i++;
        i++;
      }
    } else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth === 0) break;
    i++;
  }
  return source.slice(begin, i);
}

/** 按顶层逗号切分参数列表(忽略字符串与括号内部的逗号) */
function splitTopLevel(text) {
  const parts = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      buf += ch;
      i++;
      while (i < text.length && text[i] !== quote) {
        buf += text[i];
        if (text[i] === '\\') {
          i++;
          if (i < text.length) buf += text[i];
        }
        i++;
      }
      buf += text[i];
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim() !== '') parts.push(buf.trim());
  return parts;
}

/** 去掉字符串字面量两侧的引号;非字面量原样返回 */
function unquote(value) {
  const text = String(value ?? '').trim();
  if (text.length >= 2 && (text[0] === "'" || text[0] === '"') && text[text.length - 1] === text[0]) {
    return text.slice(1, -1);
  }
  return text;
}

/** 把 `X.NAME` / `NAME` 形式的常量引用解析为同一文件内同名静态常量的值(解析不到时原样返回) */
function resolveLocalConstRef(source, raw) {
  const text = String(raw ?? '').trim();
  const m = /^(?:[A-Za-z_][\w]*\.)?([A-Za-z_][\w]*)$/.exec(text);
  if (!m) return text;
  const value = readStaticConst(source, m[1]) ?? readJavaConst(source, m[1]);
  return value === null ? text : value;
}

/** 取 `marker` 之后直到配对括号/方括号结束的文本(用于抽数组字面量或方法体) */
function extractBracketBody(source, marker, open = '[', close = ']') {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const begin = source.indexOf(open, start + marker.length);
  if (begin < 0) return null;
  let depth = 0;
  for (let i = begin; i < source.length; i++) {
    const ch = source[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return source.slice(begin + 1, i);
    }
  }
  return null;
}

/** 提取 TS `static readonly NAME = <简单字面量>` 形式的常量 */
function readStaticConst(source, name) {
  const re = new RegExp(`static\\s+readonly\\s+${name}\\s*=\\s*([^;\\n]+)`);
  const m = re.exec(source);
  return m ? m[1].trim() : null;
}

/** 提取 Java `static final <Type> NAME = <简单字面量>` 形式的常量 */
function readJavaConst(source, name) {
  const re = new RegExp(`static\\s+final\\s+[\\w.<>\\[\\]]+\\s+${name}\\s*=\\s*([^;\\n]+)`);
  const m = re.exec(source);
  return m ? m[1].trim() : null;
}

/** 把"数字字面量 / 命名常量"解析为数字 */
function resolveNumber(raw, constName, constValue) {
  const text = String(raw ?? '').trim();
  if (/^-?[0-9.]+$/.test(text)) return Number(text);
  if (constName && constValue !== null && (text === constName || text.endsWith(`.${constName}`))) {
    return Number(constValue);
  }
  return NaN;
}

/** 把"字符串字面量 / 命名常量"解析为字符串 */
function resolveString(raw, constName, constValue) {
  const text = String(raw ?? '').trim();
  if (constName && constValue !== null && (text === constName || text.endsWith(`.${constName}`))) {
    return unquote(constValue);
  }
  return unquote(text);
}

// ---------------------------------------------------------------------------
// 物品:TS 侧
// ---------------------------------------------------------------------------
function parseTsItems() {
  const source = read(TS_ITEM_REGISTRY);
  const inventory = read(TS_INVENTORY);
  const itemMaxStack = /const\s+INVENTORY_ITEM_MAX_STACK\s*=\s*([0-9]+)/.exec(inventory)?.[1] ?? null;
  if (itemMaxStack === null) {
    throw new Error('无法从 Inventory.ts 解析 INVENTORY_ITEM_MAX_STACK');
  }

  const items = [];
  const re = /tag:\s*'([^']+)',\s*\n\s*name:\s*'([^']*)',\s*\n\s*description:\s*'([^']*)',\s*\n\s*color:\s*'([^']*)',\s*\n\s*icon:\s*'([^']*)',\s*\n\s*heal:\s*([0-9.]+),\s*\n\s*maxStack:\s*([A-Za-z_0-9.]+)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    items.push({
      tag: m[1],
      name: m[2],
      description: m[3],
      color: m[4],
      icon: m[5],
      heal: Number(m[6]),
      maxStack: resolveNumber(m[7], 'INVENTORY_ITEM_MAX_STACK', itemMaxStack)
    });
  }
  if (items.length === 0) throw new Error('未从 ItemRegistry.ts 解析到任何物品定义');
  return { items, itemMaxStack: Number(itemMaxStack) };
}

// ---------------------------------------------------------------------------
// 物品:Java 侧
// ---------------------------------------------------------------------------
function parseJavaItems() {
  const source = read(JAVA_ITEM_REGISTRY);
  const javaMaxStack = /ITEM_MAX_STACK\s*=\s*([0-9]+)/.exec(read(JAVA_INVENTORY))?.[1] ?? null;
  if (javaMaxStack === null) {
    throw new Error('无法从 Inventory.java 解析 ITEM_MAX_STACK');
  }

  const items = [];
  const re = /register\(new ItemDefinition\(([\s\S]*?)\)\);/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const args = splitTopLevel(m[1]);
    if (args.length < 7) continue;
    items.push({
      tag: unquote(args[0]),
      name: unquote(args[1]),
      description: unquote(args[2]),
      color: unquote(args[3]),
      icon: unquote(args[4]),
      heal: resolveNumber(args[5], null, null),
      maxStack: resolveNumber(args[6], 'ITEM_MAX_STACK', javaMaxStack)
    });
  }
  if (items.length === 0) throw new Error('未从 Inventory.java 解析到任何物品定义');
  return { items, itemMaxStack: Number(javaMaxStack) };
}

// ---------------------------------------------------------------------------
// 技能:TS 侧
// ---------------------------------------------------------------------------
function parseTsSkills() {
  const files = walk(TS_SKILLS_DIR).filter((f) => f.endsWith('.ts'));
  const skills = [];
  const tags = new Set();

  for (const file of files) {
    const source = read(file);
    const tag = unquote(readStaticConst(source, 'TAG') ?? '');
    if (!tag) throw new Error(`${path.basename(file)} 缺少 static readonly TAG`);

    const superArgs = extractCallArgs(source, 'super');
    if (superArgs === null) throw new Error(`${path.basename(file)} 未找到 super(...) 调用`);
    const args = splitTopLevel(superArgs);

    const cooldownRaw = args[5] ?? '';
    const cooldownConst = readStaticConst(source, 'COOLDOWN');

    skills.push({
      tag,
      shortName: unquote(args[2] ?? ''),
      name: unquote(args[1] ?? ''),
      description: unquote(args[3] ?? ''),
      color: unquote(resolveLocalConstRef(source, args[4] ?? '')),
      cooldown: resolveNumber(cooldownRaw, 'COOLDOWN', cooldownConst),
      icon: unquote(resolveLocalConstRef(source, args[6] ?? '')),
      trigger: args[7] ? unquote(args[7]) : 'fire',
      file: path.relative(ROOT, file)
    });
    tags.add(tag);
  }
  if (skills.length === 0) throw new Error('未在 class/Skill/Skills 下解析到任何技能');
  return { skills, tags };
}

// ---------------------------------------------------------------------------
// 技能:Java 侧
// ---------------------------------------------------------------------------
function parseJavaSkills() {
  const files = walk(JAVA_GAME_DIR).filter((f) => f.endsWith('Skill.java') && path.basename(f) !== 'Skill.java');
  const skills = [];

  for (const file of files) {
    const source = read(file);
    const tag = unquote(readJavaConst(source, 'TAG') ?? '');
    if (!tag) throw new Error(`${path.basename(file)} 缺少 TAG 常量`);

    const superArgs = extractCallArgs(source, 'super');
    if (superArgs === null) throw new Error(`${path.basename(file)} 未找到 super(...) 调用`);
    const args = splitTopLevel(superArgs);

    const cooldownRaw = args[5] ?? '';
    const cooldownConst = readJavaConst(source, 'COOLDOWN');
    const triggerRaw = args[7] ? args[7].trim() : '';

    skills.push({
      tag,
      shortName: unquote(args[2] ?? ''),
      name: unquote(args[1] ?? ''),
      description: unquote(args[3] ?? ''),
      color: unquote(resolveLocalConstRef(source, args[4] ?? '')),
      cooldown: resolveNumber(cooldownRaw, 'COOLDOWN', cooldownConst),
      icon: unquote(resolveLocalConstRef(source, args[6] ?? '')),
      trigger: triggerRaw === '' ? 'fire' : (triggerRaw.endsWith('DODGE') ? 'dodge' : unquote(triggerRaw)),
      file: path.relative(ROOT, file)
    });
  }
  if (skills.length === 0) throw new Error('未在 java/.../game 下解析到任何技能');
  return { skills };
}

// ---------------------------------------------------------------------------
// 注册表完整性
// ---------------------------------------------------------------------------
/** TS 技能注册表登记的类名 → 由 TAG 常量反查 tag */
function parseTsSkillRegistryTags(tagByClass) {
  const source = read(TS_SKILL_REGISTRY);
  const re = /\[\s*([A-Za-z0-9_]+)\.TAG\s*,\s*new\s+[A-Za-z0-9_]+\s*\(\s*\)\s*\]/g;
  const tags = new Set();
  let m;
  while ((m = re.exec(source)) !== null) {
    const tag = tagByClass.get(m[1]);
    if (!tag) throw new Error(`技能注册表引用了未知技能类:${m[1]}`);
    tags.add(tag);
  }
  if (tags.size === 0) throw new Error('未从 class/Skill/index.ts 解析到任何技能注册项');
  return tags;
}

/** Java 技能注册表登记的类名 → 由 TAG 常量反查 tag */
function parseJavaSkillRegistryTags(tagByClass) {
  const source = read(JAVA_SKILL_REGISTRY);
  const re = /register\(new\s+([A-Za-z0-9_]+)\s*\(\s*\)\s*\)/g;
  const tags = new Set();
  let m;
  while ((m = re.exec(source)) !== null) {
    const tag = tagByClass.get(m[1]);
    if (!tag) throw new Error(`Java 技能注册表引用了未知技能类:${m[1]}`);
    tags.add(tag);
  }
  if (tags.size === 0) throw new Error('未从 java/.../game/Skill.java 解析到任何技能注册项');
  return tags;
}

/** TS SkillTagType 联合类型包含的 tag 集合 */
function parseTsSkillTagType() {
  const source = read(TS_SKILL_BASE);
  const block = /export\s+type\s+SkillTagType\s*=\s*([\s\S]*?);/.exec(source)?.[1];
  if (!block) throw new Error('未在 Skill.ts 中找到 SkillTagType 联合类型');
  const tags = new Set();
  for (const m of block.matchAll(/'([^']+)'/g)) tags.add(m[1]);
  if (tags.size === 0) throw new Error('SkillTagType 未解析到任何取值');
  return tags;
}

// ---------------------------------------------------------------------------
// 实体:TS ↔ Java 配对、常量比对、tag 比对
// ---------------------------------------------------------------------------
const TS_ENTITY_DIR = path.join(ROOT, 'class/Entity');
const JAVA_ENTITY_DIR = path.join(JAVA_ROOT, 'entity');
const TS_ENTITY_FACTORY = path.join(ROOT, 'registry/EntityFactory.ts');
const TS_SERVICE_FILE = path.join(ROOT, 'service/Service.ts');
const JAVA_WORLD_FILE = path.join(JAVA_ROOT, 'world/World.java');

/** 已知的"只在一侧存在且属预期"的实体类名(不报为问题,仅在汇总里提示) */
const ENTITY_ONE_SIDED_EXPECTED = new Set([
  'OrdinaryBullet',  // Java 用 BulletEntity(基类)直接表示普通子弹
  'GroundItem',      // TS 侧叫 ItemDynamicEntity,与 Java GroundItemEntity 命名不同构
  'WorldView',       // Java 专有的实体层视图接口
  'AbsorbableOrb',   // Java 专有的掉落物接口(TS 侧用联合类型表达)
  'Empty',           // TS 专用的纯渲染实体
  'FoodItem',        // TS 侧物品分类,Java 用带 tag 的单一 GroundItemEntity 表示
  'HealingGemItem',  // 同上
  'FragGrenade',     // TS 侧手雷变体,Java 用 BombEntity + tag 表示
  'SmokeGrenade',
  'StunGrenade',
  'Friendly',        // TS 侧的 NPC 分类基类
  'Hostile',
  'Neutral',
  'BoxStatic',       // TS 侧静态实体分类
  'WallStatic',
  'CurbStatic',
  'CurbStaticEntity8Length'
]);

/** 两侧命名不同构但确实对应的实体类(TS 类名 → Java 类名) */
const ENTITY_PAIR_ALIASES = new Map([
  ['Grenade', 'Bomb'],
  ['Item', 'GroundItem']
]);

/**
 * 抽取字面量里的数字序列(形如 `[1, 3, 7]` / `{1, 3, 7}`);
 * 非纯数字字面量(含表达式/符号)返回 null。
 */
function numberList(raw) {
  const text = String(raw ?? '').trim();
  if (!/^[\s\d.,\[\]{}_-]+$/.test(text)) return null;
  const nums = [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  return nums.length > 0 ? nums : null;
}

/** 类名归一化:两侧反复剥离 DynamicEntity / Npc / Entity 后缀后比对 */
function entityKey(name) {
  let key = name;
  for (;;) {
    const next = key.replace(/(DynamicEntity|Npc|Entity)$/, '');
    if (next === key || next === '') break;
    key = next;
  }
  return key;
}

/** 常量右侧文本分类:number / string / expr(表达式不参与数值比对,只提示) */
function classifyConstValue(raw) {
  const text = String(raw ?? '').trim();
  const str = /^(['"])([\s\S]*)\1$/.exec(text);
  if (str) return { kind: 'string', value: str[2], raw: text };
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { kind: 'number', value: Number(text), raw: text };
  return { kind: 'expr', value: text, raw: text };
}

/** 从构造器的 super(...) 参数里取最后一个字符串字面量作为实体 tag */
function entityTagFromSuper(source) {
  const args = extractCallArgs(source, 'super');
  if (args === null) return null;
  const parts = splitTopLevel(args);
  for (let i = parts.length - 1; i >= 0; i--) {
    const literal = /^\s*(['"])([^'"]*)\1\s*$/.exec(parts[i]);
    if (literal) return literal[2];
  }
  return null;
}

/** 把 `X.TAG` / `'tag'` 解析为技能 tag(借技能表反查) */
function resolveSkillTagRef(raw, skills) {
  const text = String(raw ?? '').trim();
  const literal = /^['"]([^'"]*)['"]$/.exec(text);
  if (literal) return literal[1];
  const m = /^(?:([A-Za-z_][\w]*)\.)?TAG$/.exec(text);
  if (!m) return text;
  if (!m[1]) return text;
  const skill = skills.find((s) => classOf(s.file) === m[1]);
  return skill ? skill.tag : text;
}

/** 数字字面量或同类常量引用 → 数字(解析不到返回 null) */
function resolveNumberRef(raw, source) {
  const text = String(raw ?? '').trim();
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const resolved = String(resolveLocalConstRef(source, text)).trim();
  return /^-?\d+(?:\.\d+)?$/.test(resolved) ? Number(resolved) : null;
}

/** 解析 TS 实体文件:类名、父类、tag、静态常量表、战利品表(非实体模块文件返回 null) */
function parseTsEntityFile(file, skills) {
  const source = read(file);
  if (!/^\s*(?:export\s+)?(?:abstract\s+)?class\s+[A-Za-z0-9_]+/m.test(source)) return null;
  const className = path.basename(file, '.ts');
  const constants = new Map();
  const re = /static\s+(?:readonly\s+)?([A-Za-z_][\w]*)\s*(?::[^=;\n]+)?=\s*([^;\n]+);/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    constants.set(m[1], classifyConstValue(m[2]));
  }
  const extendsName = /class\s+[A-Za-z0-9_]+\s+extends\s+([A-Za-z0-9_]+)/.exec(source)?.[1] ?? null;
  return {
    className,
    key: entityKey(className),
    tag: entityTagFromSuper(source),
    extendsName,
    constants,
    loot: parseTsLoot(source, skills),
    file: path.relative(ROOT, file)
  };
}

/** 解析 TS 的 `this.loot = [ { type: 'skillOrb', tag: X.TAG, odds: 0.2 } ];` */
function parseTsLoot(source, skills) {
  const block = /this\.loot\s*=\s*\[([\s\S]*?)\];/.exec(source)?.[1] ?? null;
  if (block === null) return null;
  const loot = [];
  for (const m of block.matchAll(/\{([^{}]*)\}/g)) {
    const body = m[1];
    loot.push({
      type: /type:\s*['"]([^'"]*)['"]/.exec(body)?.[1] ?? null,
      tag: resolveSkillTagRef(/tag:\s*([A-Za-z0-9_.]+|['"][^'"]*['"])/.exec(body)?.[1], skills),
      odds: resolveNumberRef(/odds:\s*([A-Za-z0-9_.]+)/.exec(body)?.[1], source)
    });
  }
  return loot;
}

/** 解析 Java 的 `this.loot.add(new Loot("skillOrb", X.TAG, LOOT_ODDS));` */
function parseJavaLoot(source, skills) {
  if (!/this\.loot/.test(source)) return null;
  const loot = [];
  for (const m of source.matchAll(/this\.loot\.add\(\s*new\s+Loot\(([^)]*)\)\s*\)/g)) {
    const args = splitTopLevel(m[1]);
    loot.push({
      type: unquote(args[0] ?? ''),
      tag: resolveSkillTagRef(args[1], skills),
      odds: resolveNumberRef(args[2], source)
    });
  }
  return loot;
}

/** 解析 Java 实体文件:类名、tag、静态常量表、战利品表 */
function parseJavaEntityFile(file, skills) {
  const source = read(file);
  const className = path.basename(file, '.java');
  const constants = new Map();
  const re = /static\s+final\s+[\w.<>\[\],\s]+?\s+([A-Za-z_][\w]*)\s*=\s*([^;\n]+);/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    constants.set(m[1], classifyConstValue(m[2]));
  }
  return {
    className,
    key: entityKey(className),
    tag: entityTagFromSuper(source),
    constants,
    loot: parseJavaLoot(source, skills),
    file: path.relative(ROOT, file)
  };
}

/** 比对同一实体的战利品表(type/tag/odds 多重集);返回是否真正比对了条目 */
function compareLoot(key, tsLoot, javaLoot) {
  if (tsLoot === null || javaLoot === null) return null;
  const fmt = (e) => `${e.type}/${e.tag}/${e.odds}`;
  const ts = tsLoot.map(fmt).sort();
  const java = javaLoot.map(fmt).sort();
  if (ts.length !== java.length || ts.some((v, i) => v !== java[i])) {
    problems.push(`实体 [${key}] 战利品表不一致:TS=[${ts.join(', ')}] / Java=[${java.join(', ')}]`);
  }
  return { key, entries: ts };
}

/** 按归一化键索引实体文件(同名时保留第一个并提示) */
function indexEntities(files, parser, label) {
  const byKey = new Map();
  for (const file of files) {
    const entity = parser(file);
    if (entity === null) continue;
    if (byKey.has(entity.key)) {
      notes.push(`${label} 实体类名归一化后重名:${byKey.get(entity.key).className} / ${entity.className}`);
      continue;
    }
    byKey.set(entity.key, entity);
  }
  return byKey;
}

/**
 * 比对同一实体的两侧静态常量。
 * 只比对两侧同名字段(允许 TS 侧多一个 PLAYER_ 前缀,如 PLAYER_MOTION_DAMPING ↔ MOTION_DAMPING);
 * 表达式字面量退化为数字序列/提示,避免误报。
 */
function compareEntityConstants(tsByKey, javaByKey, tsBaseClasses) {
  const pairs = [];
  const matchedJavaKeys = new Set();
  const tsOnlyEntityNames = [];
  const javaOnlyEntityNames = [];
  const comparedLoot = [];
  const isTaglike = (t) => typeof t === 'string' && /^[a-z][a-z0-9_]*$/.test(t);

  for (const [key, ts] of tsByKey) {
    const alias = ENTITY_PAIR_ALIASES.get(key);
    const java = javaByKey.get(key) ?? (alias ? javaByKey.get(entityKey(alias)) : undefined);
    if (!java) {
      tsOnlyEntityNames.push(ts.className);
      continue;
    }
    matchedJavaKeys.add(java.key);
    pairs.push({ key, ts, java });

    // tag(由 super(...) 推断;抽象基类的 tag 只是分类占位,不参与比对)
    if (!tsBaseClasses.has(ts.className) && isTaglike(ts.tag) && isTaglike(java.tag) && ts.tag !== java.tag) {
      problems.push(`实体 [${key}] 的 tag 不一致:TS="${ts.tag}" / Java="${java.tag}"`);
    }

    const javaNameFor = (tsName) =>
      java.constants.has(tsName)
        ? tsName
        : tsName.startsWith('PLAYER_') && java.constants.has(tsName.slice('PLAYER_'.length))
          ? tsName.slice('PLAYER_'.length)
          : null;
    const javaHasFor = (tsName) => javaNameFor(tsName) !== null;
    const tsHasFor = (javaName) => ts.constants.has(javaName) || ts.constants.has(`PLAYER_${javaName}`);

    for (const [name, tsConst] of ts.constants) {
      const javaName = javaNameFor(name);
      if (javaName === null) continue;
      const javaConst = java.constants.get(javaName);
      const label = javaName === name ? name : `${name} ↔ ${javaName}`;

      if (tsConst.kind === 'expr' || javaConst.kind === 'expr') {
        const tsList = numberList(tsConst.raw);
        const javaList = numberList(javaConst.raw);
        if (tsList && javaList) {
          if (tsList.length !== javaList.length || tsList.some((v, i) => Math.abs(v - javaList[i]) > 1e-9)) {
            problems.push(`实体 [${key}].${label} 数字序列不一致:TS=[${tsList.join(', ')}] / Java=[${javaList.join(', ')}]`);
          }
        } else if (tsConst.raw !== javaConst.raw) {
          notes.push(`实体 [${key}].${label} 两侧均非字面量(TS=${tsConst.raw} / Java=${javaConst.raw})`);
        }
        continue;
      }
      if (tsConst.kind !== javaConst.kind) {
        problems.push(`实体 [${key}].${label} 类型不一致:TS=${tsConst.raw} / Java=${javaConst.raw}`);
        continue;
      }
      if (tsConst.kind === 'number') {
        if (Math.abs(tsConst.value - javaConst.value) > 1e-9) {
          problems.push(`实体 [${key}].${label} 不一致:TS=${tsConst.value} / Java=${javaConst.value}`);
        }
      } else if (tsConst.value !== javaConst.value) {
        problems.push(`实体 [${key}].${label} 不一致:TS="${tsConst.value}" / Java="${javaConst.value}"`);
      }
    }

    const tsOnly = [...ts.constants.keys()].filter((n) => !javaHasFor(n));
    const javaOnly = [...java.constants.keys()].filter((n) => !tsHasFor(n));
    if (tsOnly.length || javaOnly.length) {
      notes.push(
        `实体 [${key}] 单侧常量:` +
          (tsOnly.length ? ` 仅 TS [${tsOnly.join(', ')}]` : '') +
          (javaOnly.length ? ` 仅 Java [${javaOnly.join(', ')}]` : '')
      );
    }

    const loot = compareLoot(key, ts.loot, java.loot);
    if (loot !== null) comparedLoot.push(loot);
  }

  if (comparedLoot.length > 0) {
    notes.push(
      `战利品表已比对 ${comparedLoot.length} 个实体:` +
        comparedLoot.map((l) => `${l.key}${l.entries.length ? `[${l.entries.join(', ')}]` : '[]'}`).join('; ')
    );
  }

  for (const [key, java] of javaByKey) {
    if (!matchedJavaKeys.has(key)) javaOnlyEntityNames.push(java.className);
  }
  const unexpected = (names) => names.filter((n) => !ENTITY_ONE_SIDED_EXPECTED.has(entityKey(n)));
  const tsOnlyUnexpected = unexpected(tsOnlyEntityNames);
  const javaOnlyUnexpected = unexpected(javaOnlyEntityNames);
  if (tsOnlyUnexpected.length > 0) {
    notes.push(`实体类只有 TS 侧(${tsOnlyUnexpected.length} 个):${tsOnlyUnexpected.join(', ')}`);
  }
  if (javaOnlyUnexpected.length > 0) {
    notes.push(`实体类只有 Java 侧(${javaOnlyUnexpected.length} 个):${javaOnlyUnexpected.join(', ')}`);
  }
  return pairs;
}

/** TS EntityFactory 是否覆盖了所有具体实体的 tag(客户端按 tag 反序列化快照) */
function checkEntityFactoryCoverage(pairs, tsBaseClasses) {
  const source = read(TS_ENTITY_FACTORY);
  // case '<tag>': 与 kind === '<kind>' / === '<kind>' 两种分派形式
  const covered = new Set([...source.matchAll(/(?:case\s+|===\s*)'([^']+)'/g)].map((m) => m[1]));
  if (covered.size === 0) throw new Error('未从 EntityFactory.ts 解析到任何 tag/kind 分支');
  const missing = pairs
    .filter(({ ts }) => typeof ts.tag === 'string' && /^[a-z][a-z0-9_]*$/.test(ts.tag))
    .filter(({ ts }) => !tsBaseClasses.has(ts.className))
    .filter(({ ts }) => !covered.has(ts.tag))
    .map(({ key, ts }) => `${key}(tag=${ts.tag})`);
  if (missing.length > 0) {
    problems.push(`EntityFactory.ts 未覆盖以下实体 tag:${missing.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// NPC 生成权重表(TS SPAWNABLE_NPC_CLASSES ↔ Java World.createRandomNpc)
// ---------------------------------------------------------------------------
/** 解析 TS Service.ts 的可生成 NPC 类列表 */
function parseTsSpawnableNpcClasses() {
  const body = extractBracketBody(read(TS_SERVICE_FILE), 'SPAWNABLE_NPC_CLASSES');
  if (body === null) throw new Error('未在 Service.ts 中找到 SPAWNABLE_NPC_CLASSES 数组');
  const names = [];
  for (const line of body.replace(/\/\/[^\n]*/g, '').split('\n')) {
    const name = line.trim().replace(/,$/, '');
    if (/^[A-Za-z_][\w]*$/.test(name)) names.push(name);
  }
  if (names.length === 0) throw new Error('SPAWNABLE_NPC_CLASSES 未解析到任何类名');
  return names;
}

/** 求和形如 `0.2 + 0.1 + 0.4` 的字面量表达式 */
function evalLiteralSum(text) {
  const parts = String(text ?? '').replace(/\s/g, '').split('+');
  if (parts.length === 0 || parts.some((p) => !/^-?\d+(?:\.\d+)?$/.test(p))) return null;
  return Number(parts.reduce((a, p) => a + Number(p), 0).toFixed(9));
}

/** 解析 Java World.createRandomNpc 的权重阶梯(最后一个 else 取剩余权重) */
function parseJavaNpcWeightLadder() {
  const source = read(JAVA_WORLD_FILE);
  const start = source.indexOf('private NpcEntity createRandomNpc(');
  if (start < 0) throw new Error('未在 World.java 中找到 createRandomNpc');
  const end = source.indexOf('\n    }', start);
  const body = source.slice(start, end < 0 ? undefined : end);

  const total = evalLiteralSum(/double\s+total\s*=\s*([^;]+);/.exec(body)?.[1] ?? null);
  const entries = [];
  const first = /if\s*\(\s*random\s*<\s*([\d.]+)\s*\)\s*\{[\s\S]*?npc\s*=\s*new\s+([A-Za-z0-9_]+)/.exec(body);
  if (first) entries.push({ className: first[2], weight: Number(first[1]) });
  for (const m of body.matchAll(/\(random\s*-=\s*[\d.]+\s*\)\s*<\s*([\d.]+)\s*\)\s*\{[\s\S]*?npc\s*=\s*new\s+([A-Za-z0-9_]+)/g)) {
    entries.push({ className: m[2], weight: Number(m[1]) });
  }
  const last = /\}\s*else\s*\{\s*npc\s*=\s*new\s+([A-Za-z0-9_]+)/.exec(body);
  if (last && total !== null) {
    const sum = entries.reduce((a, e) => a + e.weight, 0);
    entries.push({ className: last[1], weight: Number((total - sum).toFixed(9)) });
  }
  if (entries.length === 0) throw new Error('未解析到 createRandomNpc 的权重阶梯');
  return { total, entries };
}

/** 比对两侧 NPC 生成权重(类 ↔ 权重) */
function checkNpcWeights(tsByKey, javaByKey, tsSpawnableClasses, javaLadder) {
  const tsWeights = new Map();
  for (const className of tsSpawnableClasses) {
    const entity = tsByKey.get(entityKey(className));
    const weight = entity?.constants.get('GENERATE_WEIGHT');
    if (!entity || !weight || weight.kind !== 'number') {
      problems.push(`TS 可生成 NPC ${className} 缺少可解析的 GENERATE_WEIGHT`);
      continue;
    }
    tsWeights.set(entity.key, { className, weight: weight.value });
  }
  const javaWeights = new Map(javaLadder.entries.map((e) => [entityKey(e.className), e]));

  compareSets('可生成 NPC 集合(TS SPAWNABLE_NPC_CLASSES ↔ Java createRandomNpc)', new Set(tsWeights.keys()), new Set(javaWeights.keys()));

  for (const [key, ts] of tsWeights) {
    const java = javaWeights.get(key);
    if (!java) continue;
    if (Math.abs(ts.weight - java.weight) > 1e-9) {
      problems.push(`NPC 生成权重 [${key}] 不一致:TS=${ts.weight} / Java 权重阶梯=${java.weight}`);
    }
    // Java 类自身的 GENERATE_WEIGHT 必须与权重阶梯里用的数字一致(阶梯是硬编码的,容易漏改)
    const javaConst = javaByKey.get(key)?.constants.get('GENERATE_WEIGHT');
    if (javaConst && javaConst.kind === 'number' && Math.abs(javaConst.value - java.weight) > 1e-9) {
      problems.push(
        `Java NPC [${key}] 的 GENERATE_WEIGHT=${javaConst.value} 与 createRandomNpc 权重阶梯=${java.weight} 不一致`
      );
    }
  }

  if (javaLadder.total !== null) {
    const sum = javaLadder.entries.reduce((a, e) => a + e.weight, 0);
    if (Math.abs(sum - javaLadder.total) > 1e-6) {
      problems.push(`Java createRandomNpc 权重总和 ${sum} ≠ total ${javaLadder.total}`);
    }
    return `TS ${tsWeights.size} 项 / Java ${javaLadder.entries.length} 项,total=${javaLadder.total}`;
  }
  return `TS ${tsWeights.size} 项 / Java ${javaLadder.entries.length} 项(未解析到 total)`;
}

// ---------------------------------------------------------------------------
// 比对工具
// ---------------------------------------------------------------------------
function compareSets(label, expected, actual) {
  const missing = [...expected].filter((t) => !actual.has(t));
  const extra = [...actual].filter((t) => !expected.has(t));
  if (missing.length || extra.length) {
    problems.push(
      `${label} 不一致` +
        (missing.length ? `;缺少 [${missing.join(', ')}]` : '') +
        (extra.length ? `;多出 [${extra.join(', ')}]` : '')
    );
  }
}

function compareRecords(label, tsList, javaList) {
  const tsByTag = new Map(tsList.map((x) => [x.tag, x]));
  const javaByTag = new Map(javaList.map((x) => [x.tag, x]));

  compareSets(`${label} 的 tag 集合(TS ↔ Java)`, new Set(tsByTag.keys()), new Set(javaByTag.keys()));

  const fields = Object.keys(tsList[0]).filter((k) => k !== 'file');
  for (const [tag, ts] of tsByTag) {
    const java = javaByTag.get(tag);
    if (!java) continue;
    for (const field of fields) {
      const a = ts[field];
      const b = java[field];
      if (typeof a === 'number' && typeof b === 'number') {
        if (Number.isNaN(a) || Number.isNaN(b)) {
          problems.push(`[${tag}].${field} 解析失败(TS=${ts[field]} / Java=${java[field]})`);
        } else if (Math.abs(a - b) > 1e-9) {
          problems.push(`[${tag}].${field} 不一致:TS=${a} / Java=${b}`);
        }
      } else if (a !== b) {
        problems.push(`[${tag}].${field} 不一致:TS="${a}" / Java="${b}"`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function main() {
  const tsItems = parseTsItems();
  const javaItems = parseJavaItems();

  const tsSkills = parseTsSkills();
  const javaSkills = parseJavaSkills();

  const tagByClass = new Map(tsSkills.skills.map((s) => [classOf(s.file), s.tag]));
  const javaTagByClass = new Map(javaSkills.skills.map((s) => [classOf(s.file), s.tag]));

  // 1. 物品
  compareRecords('物品定义', tsItems.items, javaItems.items);
  if (tsItems.itemMaxStack !== javaItems.itemMaxStack) {
    problems.push(
      `物品单格堆叠上限不一致:TS INVENTORY_ITEM_MAX_STACK=${tsItems.itemMaxStack} / Java ITEM_MAX_STACK=${javaItems.itemMaxStack}`
    );
  } else {
    notes.push(`物品单格堆叠上限:${tsItems.itemMaxStack}(两侧一致)`);
  }

  // 2. 技能
  compareRecords('技能定义', tsSkills.skills, javaSkills.skills);

  // 3. 注册表完整性
  const tsRegistryTags = parseTsSkillRegistryTags(tagByClass);
  const javaRegistryTags = parseJavaSkillRegistryTags(javaTagByClass);
  const tsTagType = parseTsSkillTagType();

  compareSets('TS 技能注册表 ↔ 技能类 TAG', tsSkills.tags, tsRegistryTags);
  compareSets('Java 技能注册表 ↔ 技能类 TAG', tsSkills.tags, javaRegistryTags);
  compareSets('SkillTagType 联合类型 ↔ 技能类 TAG', tsSkills.tags, tsTagType);

  // 4. 实体(动态实体/NPC/子弹的静态常量与 tag)
  const tsEntities = indexEntities(
    walk(TS_ENTITY_DIR).filter((f) => f.endsWith('.ts') && path.basename(f) !== 'index.ts'),
    (f) => parseTsEntityFile(f, tsSkills.skills),
    'TS'
  );
  const javaEntities = indexEntities(
    walk(JAVA_ENTITY_DIR).filter((f) => f.endsWith('.java')),
    (f) => parseJavaEntityFile(f, tsSkills.skills),
    'Java'
  );
  const entityPairs = compareEntityConstants(
    tsEntities,
    javaEntities,
    new Set([...tsEntities.values()].map((e) => e.extendsName).filter((n) => n !== null))
  );
  checkEntityFactoryCoverage(
    entityPairs,
    new Set([...tsEntities.values()].map((e) => e.extendsName).filter((n) => n !== null))
  );

  // 5. NPC 生成权重表
  const npcWeightSummary = checkNpcWeights(
    tsEntities,
    javaEntities,
    parseTsSpawnableNpcClasses(),
    parseJavaNpcWeightLadder()
  );

  // 6. 输出
  console.log(`pixel_war 契约校验(TS ↔ Java)`);
  console.log(`  物品:${tsItems.items.map((i) => i.tag).join(', ')}`);
  console.log(`  技能:${tsSkills.skills.map((s) => `${s.tag}(${s.trigger})`).join(', ')}`);
  console.log(`  实体:${entityPairs.map((p) => p.key).join(', ')}`);
  console.log(`  NPC 生成权重:${npcWeightSummary}`);
  for (const n of notes) console.log(`  - ${n}`);

  if (problems.length > 0) {
    console.error(`\n发现 ${problems.length} 处契约不一致:`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `\n✓ 契约一致:共校验 ${tsItems.items.length} 个物品、${tsSkills.skills.length} 个技能、${entityPairs.length} 个实体。`
  );
}

/** 从文件路径取技能类名(文件名即类名) */
function classOf(relPath) {
  return path.basename(relPath).replace(/\.(ts|java)$/, '');
}

try {
  main();
} catch (error) {
  console.error(`契约校验无法完成:${error.message}`);
  process.exitCode = 1;
}
