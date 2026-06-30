import type { TextFragment } from '@/types';

/** 演示「一品类多资源」：海上风电 / 安全预评价及专家审查 */
export const DEMO_MULTI_QUAL_LOT_ID =
  'lot-风电-风电-海上风电-前期-服务-安全预评价及专家审查';

const DEMO_LOT = DEMO_MULTI_QUAL_LOT_ID;

/** 专用资源管理 UI 演示：同品类下 3 条资格条件（含变量名称） */
export const DEDICATED_RESOURCE_MULTI_LOT_DEMO: TextFragment[] = [
  {
    id: 'demo-qual-lot-multi-001',
    module: 'qualification',
    name: '1.4 投标人资格要求｜基本资格条件',
    slotName: '资格条件模板1',
    content:
      '<p><strong>（演示数据）</strong>投标人应具有独立订立合同的资格和相应的履约能力；经营状况良好，没有处于被责令停业、财产被接管、破产状态。</p>',
    description: '一品类多资源演示 — 基本资格',
    createdAt: '2026-06-10',
    updatedAt: '2026-06-10',
    contentVersion: 1,
    templateSyncedVersion: {},
    bindings: [],
    versions: [],
    applicableToAllLotLevels: false,
    applicableLotLevelIds: [DEMO_LOT],
  },
  {
    id: 'demo-qual-lot-multi-002',
    module: 'qualification',
    name: '1.4 投标人资格要求｜专项资格条件',
    slotName: '资格条件模板2',
    content:
      '<p><strong>（演示数据）</strong>投标人须具有设计、制造与招标设备相同或相近设备的能力；近 5 年内具有同类设备 2 个及以上项目成功运行业绩。</p>',
    description: '一品类多资源演示 — 专项资格',
    createdAt: '2026-06-11',
    updatedAt: '2026-06-11',
    contentVersion: 1,
    templateSyncedVersion: {},
    bindings: [],
    versions: [],
    applicableToAllLotLevels: false,
    applicableLotLevelIds: [DEMO_LOT],
  },
  {
    id: 'demo-qual-lot-multi-003',
    module: 'qualification',
    name: '1.4 投标人资格要求｜联合体与禁止情形',
    slotName: '资格条件模板3',
    content:
      '<p><strong>（演示数据）</strong>本标段不接受联合体投标；投标人不得存在与招标人利害关系、控股管理关系等情形。</p>',
    description: '一品类多资源演示 — 禁止情形',
    createdAt: '2026-06-12',
    updatedAt: '2026-06-12',
    contentVersion: 1,
    templateSyncedVersion: {},
    bindings: [],
    versions: [],
    applicableToAllLotLevels: false,
    applicableLotLevelIds: [DEMO_LOT],
  },
];
