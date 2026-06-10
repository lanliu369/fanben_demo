import type { BusinessSector, BusinessType, DomainLevel, LotLevel } from '@/types';

const PINYIN_MAP: Record<string, string> = {
  陆上风电: 'LSFD',
  海上风电: 'HSFD',
  储能: 'CN',
  光伏: 'GF',
  煤电: 'MD',
  通用: 'TY',
  前期: 'QQ',
  设计: 'SJ',
  建设: 'JS',
  运行: 'YX',
  服务: 'FW',
  工程: 'GC',
  设备: 'SB',
  其他: 'QT',
};

function abbr(text: string, max = 4): string {
  const t = text.trim();
  if (!t) return 'XX';
  if (PINYIN_MAP[t]) return PINYIN_MAP[t];
  if (/^[A-Za-z0-9-]+$/.test(t)) return t.replace(/[^A-Za-z0-9]/g, '').slice(0, max).toUpperCase();
  return t.slice(0, max).toUpperCase();
}

function lotNameAbbr(name: string): string {
  const compact = name.replace(/\s/g, '');
  const known: Record<string, string> = {
    前期咨询服务: 'QQZX',
    勘察设计: 'KCSJ',
    地形图测绘: 'DXT',
    储能电站EPC: 'CN-EPC',
    储能系统设备: 'CN-XT',
    光伏项目EPC工程总承包: 'GF-EPC',
    海上风电工程EPC工程总承包: 'HS-EPC',
    陆上风电项目EPC工程总承包: 'LS-EPC',
    锅炉: 'GL',
    其他: 'QT',
  };
  if (known[compact]) return known[compact];
  return abbr(compact, 6);
}

export function buildBusinessTypeDisplayName(
  energyType: string,
  businessStage: string,
  businessNature: string,
): string {
  return `${energyType.trim()}-${businessStage.trim()}-${businessNature.trim()}`;
}

export function generateLotCode(input: {
  sector: Pick<BusinessSector, 'code'>;
  businessType: Pick<BusinessType, 'energyType' | 'businessStage' | 'businessNature'>;
  domainLevel?: Pick<DomainLevel, 'name'> | null;
  lotName: string;
}): string {
  const parts = [
    input.sector.code.trim().toUpperCase() || 'BS',
    abbr(input.businessType.energyType),
    abbr(input.businessType.businessStage),
    abbr(input.businessType.businessNature),
  ];
  if (input.domainLevel?.name?.trim()) {
    parts.push(abbr(input.domainLevel.name, 6));
  }
  parts.push(lotNameAbbr(input.lotName));
  return parts.join('-');
}

export function buildUniquenessKey(input: {
  businessSectorName: string;
  energyType: string;
  businessStage: string;
  businessNature: string;
  domainLevelName: string;
  lotName: string;
}): string {
  return [
    input.businessSectorName.trim(),
    input.energyType.trim(),
    input.businessStage.trim(),
    input.businessNature.trim(),
    input.domainLevelName.trim(),
    input.lotName.trim(),
  ]
    .join('\u0001')
    .toLowerCase();
}

export function lotUniquenessKeyFromEntities(
  sectorName: string,
  bt: BusinessType,
  domainName: string,
  lot: Pick<LotLevel, 'name'>,
): string {
  return buildUniquenessKey({
    businessSectorName: sectorName,
    energyType: bt.energyType,
    businessStage: bt.businessStage,
    businessNature: bt.businessNature,
    domainLevelName: domainName,
    lotName: lot.name,
  });
}
