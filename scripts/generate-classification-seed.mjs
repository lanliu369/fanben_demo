/**
 * 从「招采分类导入模板 (2).xlsx」生成 src/lib/classification/seed.ts
 * 运行: node scripts/generate-classification-seed.mjs
 */
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const xlsxPath = path.join(root, 'data/招采分类导入模板-2.xlsx');

const PROCUREMENT_LABELS = {
  open_tender: '公开招标',
  invited_tender: '邀请招标',
  inquiry_comparison: '询比采购',
  bidding: '竞价采购',
  negotiation: '谈判采购',
  direct: '直接采购',
};

const EVALUATION_LABELS = {
  comprehensive_score: '综合评分法',
  lowest_evaluated_price: '经评审的最低投标价法',
  other: '其他',
};

const EXAMPLE_ROW = {
  sectorName: '新能源发电',
  energyType: '陆上风电',
  businessStage: '前期',
  businessNature: '服务',
  domainLevelName: '',
  lotName: '前期咨询服务',
  procurementLabels: '公开招标',
  evaluationLabels: '综合评分法',
};

const PINYIN_MAP = {
  陆上风电: 'LSFD',
  海上风电: 'HSFD',
  储能: 'CN',
  光伏: 'GF',
  煤电: 'MD',
  通用: 'TY',
  风电: 'FD',
  前期: 'QQ',
  设计: 'SJ',
  建设: 'JS',
  运行: 'YX',
  服务: 'FW',
  工程: 'GC',
  设备: 'SB',
  其他: 'QT',
};

const LOT_ABBR = {
  前期咨询服务: 'QQZX',
  勘察设计: 'KCSJ',
  地形图测绘: 'DXT',
  测风服务: 'CFFW',
};

function abbr(text, max = 4) {
  const t = text.trim();
  if (!t) return 'XX';
  if (PINYIN_MAP[t]) return PINYIN_MAP[t];
  if (/^[A-Za-z0-9-]+$/.test(t)) return t.replace(/[^A-Za-z0-9]/g, '').slice(0, max).toUpperCase();
  return t.slice(0, max).toUpperCase();
}

function lotNameAbbr(name) {
  const compact = name.replace(/\s/g, '');
  if (LOT_ABBR[compact]) return LOT_ABBR[compact];
  return abbr(compact, 6);
}

function sectorCode(name) {
  const map = { 新能源发电: 'XNY', 传统能源: 'HD', 通用: 'TY', 风电: 'FD' };
  return map[name.trim()] ?? (name.trim().slice(0, 4).toUpperCase() || 'BS');
}

function slugKey(...parts) {
  return parts.map((p) => p.trim().toLowerCase()).join('|');
}

function stableId(prefix, key, index) {
  const base = key
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48);
  return `${prefix}-${base || index}`;
}

function parseProcurement(label) {
  const t = label.trim();
  for (const [k, v] of Object.entries(PROCUREMENT_LABELS)) {
    if (v === t) return k;
  }
  return null;
}

function parseEvaluation(label) {
  const t = label.trim();
  for (const [k, v] of Object.entries(EVALUATION_LABELS)) {
    if (v === t) return k;
  }
  return null;
}

function splitLabels(raw) {
  return raw
    .split(/[、,，;；|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isExampleRow(fields) {
  return (
    fields.sectorName === EXAMPLE_ROW.sectorName &&
    fields.energyType === EXAMPLE_ROW.energyType &&
    fields.businessStage === EXAMPLE_ROW.businessStage &&
    fields.businessNature === EXAMPLE_ROW.businessNature &&
    (fields.domainLevelName || '') === EXAMPLE_ROW.domainLevelName &&
    fields.lotName === EXAMPLE_ROW.lotName &&
    fields.procurementLabels === EXAMPLE_ROW.procurementLabels &&
    fields.evaluationLabels === EXAMPLE_ROW.evaluationLabels
  );
}

function generateLotCode(sector, bt, domain, lotName) {
  const parts = [
    sector.code,
    abbr(bt.energyType),
    abbr(bt.businessStage),
    abbr(bt.businessNature),
  ];
  if (domain?.name?.trim()) parts.push(abbr(domain.name, 6));
  parts.push(lotNameAbbr(lotName));
  return parts.join('-');
}

function esc(s) {
  return JSON.stringify(s);
}

function parseRows() {
  const buf = fs.readFileSync(xlsxPath);
  const wb = XLSX.read(buf);
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const hi = matrix.findIndex((row) => (row ?? []).some((cell) => String(cell).trim() === '业务板块名称'));
  if (hi < 0) throw new Error('未找到表头「业务板块名称」');
  const headers = matrix[hi].map((c) => String(c).trim());
  const col = (name) => {
    const i = headers.indexOf(name);
    return (r) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  };
  const rows = [];
  for (let i = hi + 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r?.some((c) => String(c).trim())) continue;
    const fields = {
      sectorName: col('业务板块名称')(r),
      energyType: col('能源类型')(r),
      businessStage: col('业务阶段')(r),
      businessNature: col('业务性质')(r),
      domainLevelName: col('系统专业阶段级别')(r),
      lotName: col('品类级别')(r),
      procurementLabels: col('采购方式')(r),
      evaluationLabels: col('评审办法')(r),
    };
    if (isExampleRow(fields)) continue;
    if (!fields.sectorName || !fields.lotName) continue;
    const procurementMethods = [];
    for (const label of splitLabels(fields.procurementLabels)) {
      const m = parseProcurement(label);
      if (m && !procurementMethods.includes(m)) procurementMethods.push(m);
    }
    const evaluationMethods = [];
    const em = parseEvaluation(fields.evaluationLabels);
    if (em) evaluationMethods.push(em);
    if (procurementMethods.length === 0 || evaluationMethods.length === 0) {
      console.warn('跳过无效行', i + 1, fields.lotName);
      continue;
    }
    rows.push({ ...fields, procurementMethods, evaluationMethods });
  }
  return rows;
}

function buildStore(rows) {
  const now = '2024-01-01';
  const sectors = new Map();
  const types = new Map();
  const domains = new Map();
  const lots = [];
  const seenLot = new Set();

  rows.forEach((row, idx) => {
    const sk = slugKey(row.sectorName);
    let sector = sectors.get(sk);
    if (!sector) {
      sector = {
        id: stableId('bs', row.sectorName, idx),
        code: sectorCode(row.sectorName),
        name: row.sectorName,
        createdAt: now,
        updatedAt: now,
      };
      sectors.set(sk, sector);
    }

    const tk = slugKey(sk, row.energyType, row.businessStage, row.businessNature);
    let bt = types.get(tk);
    if (!bt) {
      bt = {
        id: stableId('bt', `${row.sectorName}-${row.energyType}-${row.businessStage}-${row.businessNature}`, idx),
        businessSectorId: sector.id,
        energyType: row.energyType || '—',
        businessStage: row.businessStage || '—',
        businessNature: row.businessNature || '—',
        displayName: `${row.energyType}-${row.businessStage}-${row.businessNature}`,
        createdAt: now,
        updatedAt: now,
      };
      types.set(tk, bt);
    }

    let domain = undefined;
    if (row.domainLevelName) {
      const dk = slugKey(tk, row.domainLevelName);
      domain = domains.get(dk);
      if (!domain) {
        domain = {
          id: stableId('dl', `${tk}-${row.domainLevelName}`, idx),
          name: row.domainLevelName,
          businessTypeId: bt.id,
          createdAt: now,
          updatedAt: now,
        };
        domains.set(dk, domain);
      }
    }

    const lotKey = slugKey(sk, tk, row.domainLevelName, row.lotName);
    if (seenLot.has(lotKey)) return;
    seenLot.add(lotKey);

    const lotId = stableId('lot', lotKey, idx);
    lots.push({
      id: lotId,
      code: generateLotCode(sector, bt, domain, row.lotName),
      name: row.lotName,
      businessSectorId: sector.id,
      businessTypeId: bt.id,
      domainLevelId: domain?.id,
      procurementMethods: row.procurementMethods,
      evaluationMethods: row.evaluationMethods,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    businessSectors: [...sectors.values()],
    businessTypes: [...types.values()],
    domainLevels: [...domains.values()],
    lotLevels: lots,
  };
}

function emitTs(store) {
  const fmt = (obj, indent) => JSON.stringify(obj, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : indent + line))
    .join('\n');

  const lines = [];
  lines.push(`import type {`);
  lines.push(`  BusinessSector,`);
  lines.push(`  BusinessType,`);
  lines.push(`  ClassificationStore,`);
  lines.push(`  DomainLevel,`);
  lines.push(`  LotLevel,`);
  lines.push(`} from '@/types';`);
  lines.push('');
  lines.push('/**');
  lines.push(' * 默认招采分类数据，来源：data/招采分类导入模板-2.xlsx');
  lines.push(' * 重新生成：node scripts/generate-classification-seed.mjs');
  lines.push(' */');
  lines.push('');
  lines.push("const now = '2024-01-01';");
  lines.push('');
  lines.push('export const defaultClassificationStore: ClassificationStore = {');
  lines.push(`  businessSectors: ${fmt(store.businessSectors, '  ')},`);
  lines.push(`  businessTypes: ${fmt(store.businessTypes, '  ')},`);
  lines.push(`  domainLevels: ${fmt(store.domainLevels, '  ')},`);
  lines.push(`  lotLevels: ${fmt(store.lotLevels, '  ')},`);
  lines.push('};');
  lines.push('');
  const pick = (name) => store.lotLevels.find((l) => l.name === name)?.id;
  const cefeng = pick('测风服务');
  const kancha = pick('勘察设计');
  const dxt = pick('地形图测绘');
  const kxx = pick('可行性研究');
  const cbsj = pick('初步设计');
  const lotIdLines = [];
  lotIdLines.push('/**');
  lotIdLines.push(' * 种子品类 id（无 storage 依赖，供 mockData 等模块安全引用）');
  lotIdLines.push(' * 与 seed.ts 同步；重新生成：node scripts/generate-classification-seed.mjs');
  lotIdLines.push(' */');
  lotIdLines.push('export const seedLotIds = {');
  if (cefeng) lotIdLines.push(`  cefeng: ${esc(cefeng)},`);
  if (kancha) lotIdLines.push(`  kancha: ${esc(kancha)},`);
  if (dxt) lotIdLines.push(`  dxt: ${esc(dxt)},`);
  if (kxx) lotIdLines.push(`  kxx: ${esc(kxx)},`);
  if (cbsj) lotIdLines.push(`  cbsj: ${esc(cbsj)},`);
  lotIdLines.push('} as const;');
  lotIdLines.push('');
  const lotIdsPath = path.join(root, 'src/lib/classification/seed-lot-ids.ts');
  fs.writeFileSync(lotIdsPath, lotIdLines.join('\n') + '\n');
  console.log('Wrote', lotIdsPath);

  lines.push("export { seedLotIds } from './seed-lot-ids';");
  lines.push('');
  lines.push('/** 旧 categoryId → 新 lotLevelId（演示数据迁移） */');
  lines.push('export const LEGACY_CATEGORY_TO_LOT: Record<string, string> = {');
  const firstLot = store.lotLevels[0]?.id ?? '';
  const byName = (n) => store.lotLevels.find((l) => l.name === n)?.id ?? firstLot;
  lines.push(`  'cat-1-1-1': ${esc(byName('储能电站EPC') || firstLot)},`);
  lines.push(`  'cat-1-1-2': ${esc(byName('储能系统设备') || firstLot)},`);
  lines.push(`  'cat-2-2-1': ${esc(byName('光伏项目EPC工程总承包') || firstLot)},`);
  lines.push(`  'cat-7-2-1': ${esc(byName('陆上风电项目EPC工程总承包') || firstLot)},`);
  lines.push(`  'cat-1-2-1': ${esc(byName('前期咨询服务') || byName('测风服务') || firstLot)},`);
  lines.push(`  'cat-1-2-2': ${esc(byName('勘察设计') || firstLot)},`);
  lines.push(`  'cat-1-2-3': ${esc(byName('地形图测绘') || firstLot)},`);
  lines.push(`  'cat-3-1-1': ${esc(byName('海上风电工程EPC工程总承包') || firstLot)},`);
  lines.push(`  'cat-4-1-1': ${esc(byName('锅炉') || firstLot)},`);
  lines.push(`  'cat-5-1-1': ${esc(byName('其他') || firstLot)},`);
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

const rows = parseRows();
const store = buildStore(rows);
console.log(
  `sectors=${store.businessSectors.length} types=${store.businessTypes.length} domains=${store.domainLevels.length} lots=${store.lotLevels.length}`,
);
const out = path.join(root, 'src/lib/classification/seed.ts');
fs.writeFileSync(out, emitTs(store) + '\n');
console.log('Wrote', out);
