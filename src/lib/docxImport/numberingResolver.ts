import { parseXml, childByTag, childrenByTag, wAttr } from './xmlUtils';

export interface NumberingLevel {
  ilvl: string;
  numFmt: string;
  lvlText: string;
  lvlJc?: string;
  pStyle?: string;
}

export interface AbstractNum {
  abstractNumId: string;
  levels: Map<string, NumberingLevel>;
}

/**
 * 编号解析器：处理 numbering.xml 中的列表定义
 */
export class NumberingResolver {
  private abstractNums = new Map<string, AbstractNum>();
  private numIdToAbstract = new Map<string, string>();

  constructor(numberingXml: string | null | undefined) {
    if (numberingXml) {
      this.loadNumbering(numberingXml);
    }
  }

  private loadNumbering(xml: string) {
    const doc = parseXml(xml);

    // abstractNum
    const abstractNumEls = childrenByTag(doc.documentElement, 'abstractNum');
    abstractNumEls.forEach((el) => {
      const id = attr(el, 'abstractNumId') ?? '';
      const levels = new Map<string, NumberingLevel>();
      const lvlEls = childrenByTag(el, 'lvl');
      lvlEls.forEach((lvl) => {
        const ilvl = attr(lvl, 'ilvl') ?? '0';
        levels.set(ilvl, {
          ilvl,
          numFmt: wAttr(childByTag(lvl, 'numFmt'), 'val') || 'decimal',
          lvlText: wAttr(childByTag(lvl, 'lvlText'), 'val') || '',
          lvlJc: wAttr(childByTag(lvl, 'lvlJc'), 'val') || undefined,
          pStyle: wAttr(childByTag(lvl, 'pStyle'), 'val') || undefined,
        });
      });
      this.abstractNums.set(id, { abstractNumId: id, levels });
    });

    // num 映射
    const numEls = childrenByTag(doc.documentElement, 'num');
    numEls.forEach((el) => {
      const numId = attr(el, 'numId') ?? '';
      const abstractNumId = wAttr(childByTag(el, 'abstractNumId'), 'val') ?? '';
      this.numIdToAbstract.set(numId, abstractNumId);
    });
  }

  /**
   * 获取编号格式信息
   */
  resolve(numId: string, ilvl: string): NumberingLevel | null {
    const abstractId = this.numIdToAbstract.get(numId);
    if (!abstractId) return null;
    const abstract = this.abstractNums.get(abstractId);
    if (!abstract) return null;
    return abstract.levels.get(ilvl) || null;
  }

  /**
   * 根据 numFmt 判断是否是有序列表
   */
  isOrdered(numId: string, ilvl: string): boolean {
    const lvl = this.resolve(numId, ilvl);
    if (!lvl) return false;
    return ['decimal', 'upperRoman', 'lowerRoman', 'upperLetter', 'lowerLetter', 'chineseCounting'].includes(lvl.numFmt);
  }

  /**
   * 根据 numFmt 判断是否是无序列表
   */
  isUnordered(numId: string, ilvl: string): boolean {
    const lvl = this.resolve(numId, ilvl);
    if (!lvl) return false;
    return ['bullet', 'none'].includes(lvl.numFmt);
  }

  /**
   * 获取列表级别文本（如 %1. 或 •）
   */
  getLevelText(numId: string, ilvl: string): string | null {
    const lvl = this.resolve(numId, ilvl);
    return lvl?.lvlText ?? null;
  }
}

function attr(el: Element | null | undefined, name: string): string | null {
  return el?.getAttribute(name) ?? null;
}
