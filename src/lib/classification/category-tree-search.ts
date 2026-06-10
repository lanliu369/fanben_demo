import type { DirectoryTreeNode } from './category-directory-tree';

export type DirectoryExpandKeys = Set<string>;

function nodeMatches(node: DirectoryTreeNode, q: string): boolean {
  const nameHit = node.name.toLowerCase().includes(q);
  const descHit =
    node.allowTreeDescription &&
    (node.description?.toLowerCase().includes(q) ?? false);
  return nameHit || descHit;
}

function filterNodes(nodes: DirectoryTreeNode[], q: string): DirectoryTreeNode[] {
  const out: DirectoryTreeNode[] = [];
  for (const node of nodes) {
    const filteredChildren = filterNodes(node.children, q);
    if (nodeMatches(node, q) || filteredChildren.length > 0) {
      out.push({ ...node, children: filteredChildren });
    }
  }
  return out;
}

function collectExpandKeys(nodes: DirectoryTreeNode[], keys: DirectoryExpandKeys) {
  for (const n of nodes) {
    if (n.children.length > 0) {
      keys.add(n.key);
      collectExpandKeys(n.children, keys);
    }
  }
}

export function filterCategoryDirectoryTree(
  tree: DirectoryTreeNode[],
  query?: string,
): { tree: DirectoryTreeNode[]; expandKeys: DirectoryExpandKeys } {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) {
    return { tree, expandKeys: new Set() };
  }
  const filtered = filterNodes(tree, q);
  const expandKeys: DirectoryExpandKeys = new Set();
  collectExpandKeys(filtered, expandKeys);
  return { tree: filtered, expandKeys };
}
