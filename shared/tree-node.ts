export class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;

  constructor(val = 0, left: TreeNode | null = null, right: TreeNode | null = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

/** Builds a binary tree from LeetCode level-order input, e.g. [3, 9, 20, null, null, 15, 7]. */
export function toTree(values: (number | null)[]): TreeNode | null {
  if (values.length === 0 || values[0] == null) return null;
  const root = new TreeNode(values[0]);
  const queue: TreeNode[] = [root];
  let i = 1;
  while (queue.length && i < values.length) {
    const node = queue.shift()!;
    const left = values[i++];
    if (left != null) queue.push((node.left = new TreeNode(left)));
    const right = values[i++];
    if (right != null) queue.push((node.right = new TreeNode(right)));
  }
  return root;
}

/** Serializes a tree back to LeetCode level-order form, trimming trailing nulls. */
export function fromTree(root: TreeNode | null): (number | null)[] {
  const out: (number | null)[] = [];
  const queue: (TreeNode | null)[] = [root];
  while (queue.length) {
    const node = queue.shift()!;
    out.push(node ? node.val : null);
    if (node) queue.push(node.left, node.right);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
