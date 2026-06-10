import type { DirectoryTreeNode } from './category-directory-tree';
import { DIRECTORY_LEVEL_LABELS, findDirectoryNode } from './category-directory-tree';

export function buildDirectoryBreadcrumb(
  tree: DirectoryTreeNode[],
  activeKey?: string,
): { key: string; name: string }[] {
  if (!activeKey) return [];
  const chain: { key: string; name: string }[] = [];

  function walk(nodes: DirectoryTreeNode[], path: { key: string; name: string }[]): boolean {
    for (const n of nodes) {
      const next = [...path, { key: n.key, name: n.name }];
      if (n.key === activeKey) {
        chain.push(...next);
        return true;
      }
      if (walk(n.children, next)) return true;
    }
    return false;
  }

  walk(tree, []);
  return chain;
}

export function directoryLevelTag(level: number): string {
  return `${DIRECTORY_LEVEL_LABELS[level as keyof typeof DIRECTORY_LEVEL_LABELS] ?? '目录'}`;
}

export function getDirectoryNodeOrNull(tree: DirectoryTreeNode[], key?: string) {
  if (!key) return null;
  return findDirectoryNode(tree, key);
}
