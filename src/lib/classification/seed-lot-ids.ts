/**
 * 种子品类 id（无 storage 依赖，供 mockData 等模块安全引用）
 * 与 seed.ts 同步；重新生成：node scripts/generate-classification-seed.mjs
 */
export const seedLotIds = {
  cefeng: 'lot-风电-风电-海上风电-前期-服务-测风服务',
  kancha: 'lot-风电-风电-海上风电-前期-服务-勘察设计',
  dxt: 'lot-风电-风电-海上风电-前期-服务-地形图测绘',
  kxx: 'lot-风电-风电-海上风电-前期-服务-可行性研究',
  cbsj: 'lot-风电-风电-海上风电-前期-服务-初步设计',
} as const;
