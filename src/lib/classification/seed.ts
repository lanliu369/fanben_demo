import type {
  BusinessSector,
  BusinessType,
  ClassificationStore,
  DomainLevel,
  LotLevel,
} from '@/types';

/**
 * 默认招采分类数据，来源：data/招采分类导入模板-2.xlsx
 * 重新生成：node scripts/generate-classification-seed.mjs
 */

const now = '2024-01-01';

export const defaultClassificationStore: ClassificationStore = {
  businessSectors: [
    {
      "id": "bs-风电",
      "code": "FD",
      "name": "风电",
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    }
  ],
  businessTypes: [
    {
      "id": "bt-风电-海上风电-前期-服务",
      "businessSectorId": "bs-风电",
      "energyType": "海上风电",
      "businessStage": "前期",
      "businessNature": "服务",
      "displayName": "海上风电-前期-服务",
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    }
  ],
  domainLevels: [],
  lotLevels: [
    {
      "id": "lot-风电-风电-海上风电-前期-服务-测风服务",
      "code": "FD-HSFD-QQ-FW-CFFW",
      "name": "测风服务",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "open_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-勘察设计",
      "code": "FD-HSFD-QQ-FW-KCSJ",
      "name": "勘察设计",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "open_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-资源评估-项目建议书-预可行性研究",
      "code": "FD-HSFD-QQ-FW-资源评估/项",
      "name": "资源评估/项目建议书/预可行性研究",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "open_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-地形图测绘",
      "code": "FD-HSFD-QQ-FW-DXT",
      "name": "地形图测绘",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "open_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-可行性研究",
      "code": "FD-HSFD-QQ-FW-可行性研究",
      "name": "可行性研究",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "open_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-项目申请报告",
      "code": "FD-HSFD-QQ-FW-项目申请报告",
      "name": "项目申请报告",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "open_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-初步设计",
      "code": "FD-HSFD-QQ-FW-初步设计",
      "name": "初步设计",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "open_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-勘测定界-压矿查询-土地调规-用地预审及规划选址",
      "code": "FD-HSFD-QQ-FW-勘测定界、压",
      "name": "勘测定界、压矿查询、土地调规、用地预审及规划选址",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "open_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-消纳报告及接入系统方案设计",
      "code": "FD-HSFD-QQ-FW-消纳报告及接",
      "name": "消纳报告及接入系统方案设计",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "invited_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-水土保持方案设计",
      "code": "FD-HSFD-QQ-FW-水土保持方案",
      "name": "水土保持方案设计",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "invited_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-气候可行性研究",
      "code": "FD-HSFD-QQ-FW-气候可行性研",
      "name": "气候可行性研究",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "invited_tender"
      ],
      "evaluationMethods": [
        "comprehensive_score"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-环境影响性评价",
      "code": "FD-HSFD-QQ-FW-环境影响性评",
      "name": "环境影响性评价",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "invited_tender"
      ],
      "evaluationMethods": [
        "lowest_evaluated_price"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-林地-草地-可行性研究",
      "code": "FD-HSFD-QQ-FW-林地（草地）",
      "name": "林地（草地）可行性研究",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "inquiry_comparison"
      ],
      "evaluationMethods": [
        "lowest_evaluated_price"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-净空影响评价",
      "code": "FD-HSFD-QQ-FW-净空影响评价",
      "name": "净空影响评价",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "inquiry_comparison"
      ],
      "evaluationMethods": [
        "lowest_evaluated_price"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-防洪影响评价",
      "code": "FD-HSFD-QQ-FW-防洪影响评价",
      "name": "防洪影响评价",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "inquiry_comparison"
      ],
      "evaluationMethods": [
        "lowest_evaluated_price"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-地灾评估及专家审查",
      "code": "FD-HSFD-QQ-FW-地灾评估及专",
      "name": "地灾评估及专家审查",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "inquiry_comparison"
      ],
      "evaluationMethods": [
        "lowest_evaluated_price"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-安全预评价及专家审查",
      "code": "FD-HSFD-QQ-FW-安全预评价及",
      "name": "安全预评价及专家审查",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "bidding"
      ],
      "evaluationMethods": [
        "lowest_evaluated_price"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-社会稳定性评价及专家审查",
      "code": "FD-HSFD-QQ-FW-社会稳定性评",
      "name": "社会稳定性评价及专家审查",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "bidding"
      ],
      "evaluationMethods": [
        "lowest_evaluated_price"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-地震安全性评价",
      "code": "FD-HSFD-QQ-FW-地震安全性评",
      "name": "地震安全性评价",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "bidding"
      ],
      "evaluationMethods": [
        "other"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-职业病危害预评价",
      "code": "FD-HSFD-QQ-FW-职业病危害预",
      "name": "职业病危害预评价",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "bidding"
      ],
      "evaluationMethods": [
        "other"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-军事影响评估",
      "code": "FD-HSFD-QQ-FW-军事影响评估",
      "name": "军事影响评估",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "negotiation"
      ],
      "evaluationMethods": [
        "other"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-文物影响评估",
      "code": "FD-HSFD-QQ-FW-文物影响评估",
      "name": "文物影响评估",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "direct"
      ],
      "evaluationMethods": [
        "other"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    },
    {
      "id": "lot-风电-风电-海上风电-前期-服务-鸟类影响评价",
      "code": "FD-HSFD-QQ-FW-鸟类影响评价",
      "name": "鸟类影响评价",
      "businessSectorId": "bs-风电",
      "businessTypeId": "bt-风电-海上风电-前期-服务",
      "procurementMethods": [
        "direct"
      ],
      "evaluationMethods": [
        "other"
      ],
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01"
    }
  ],
};

export { seedLotIds } from './seed-lot-ids';

/** 旧 categoryId → 新 lotLevelId（演示数据迁移） */
export const LEGACY_CATEGORY_TO_LOT: Record<string, string> = {
  'cat-1-1-1': "lot-风电-风电-海上风电-前期-服务-测风服务",
  'cat-1-1-2': "lot-风电-风电-海上风电-前期-服务-测风服务",
  'cat-2-2-1': "lot-风电-风电-海上风电-前期-服务-测风服务",
  'cat-7-2-1': "lot-风电-风电-海上风电-前期-服务-测风服务",
  'cat-1-2-1': "lot-风电-风电-海上风电-前期-服务-测风服务",
  'cat-1-2-2': "lot-风电-风电-海上风电-前期-服务-勘察设计",
  'cat-1-2-3': "lot-风电-风电-海上风电-前期-服务-地形图测绘",
  'cat-3-1-1': "lot-风电-风电-海上风电-前期-服务-测风服务",
  'cat-4-1-1': "lot-风电-风电-海上风电-前期-服务-测风服务",
  'cat-5-1-1': "lot-风电-风电-海上风电-前期-服务-测风服务",
};

