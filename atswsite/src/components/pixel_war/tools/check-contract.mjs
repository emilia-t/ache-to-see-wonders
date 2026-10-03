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
      color: unquote(args[4] ?? ''),
      cooldown: resolveNumber(cooldownRaw, 'COOLDOWN', cooldownConst),
      icon: resolveString(args[6] ?? '', 'ICON', readStaticConst(source, 'ICON')),
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
      color: unquote(args[4] ?? ''),
      cooldown: resolveNumber(cooldownRaw, 'COOLDOWN', cooldownConst),
      icon: resolveString(args[6] ?? '', 'ICON', readJavaConst(source, 'ICON')),
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

  // 4. 输出
  console.log(`pixel_war 契约校验(TS ↔ Java)`);
  console.log(`  物品:${tsItems.items.map((i) => i.tag).join(', ')}`);
  console.log(`  技能:${tsSkills.skills.map((s) => `${s.tag}(${s.trigger})`).join(', ')}`);
  for (const n of notes) console.log(`  - ${n}`);

  if (problems.length > 0) {
    console.error(`\n发现 ${problems.length} 处契约不一致:`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n✓ 契约一致:共校验 ${tsItems.items.length} 个物品、${tsSkills.skills.length} 个技能。`);
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
