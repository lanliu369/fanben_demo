/**
 * 旧三级品类结构（Industry → ProcurementCategory → Category）
 * 仅用于 localStorage v1 迁移读取，新代码请勿引用。
 */

export interface LegacyCategory {
  id: string;
  name: string;
  description?: string;
  procurementCategoryId: string;
  hasFramework?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LegacyProcurementCategory {
  id: string;
  name: string;
  description?: string;
  industryId: string;
  categories: LegacyCategory[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LegacyIndustry {
  id: string;
  name: string;
  description?: string;
  code?: string;
  createdAt?: string;
  updatedAt?: string;
  procurementCategories: LegacyProcurementCategory[];
}

/** v1 本地存储形态 */
export type LegacyClassificationV1Payload =
  | { industries: LegacyIndustry[] }
  | LegacyIndustry[];

export function isLegacyClassificationV1Payload(raw: unknown): raw is LegacyClassificationV1Payload {
  if (Array.isArray(raw)) {
    return raw.length === 0 || (typeof raw[0] === 'object' && raw[0] !== null && 'procurementCategories' in raw[0]);
  }
  if (raw && typeof raw === 'object' && 'industries' in raw) {
    return Array.isArray((raw as { industries: unknown }).industries);
  }
  return false;
}
