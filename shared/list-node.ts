export class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val = 0, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

/** Builds a linked list from LeetCode-style array input, e.g. [1, 2, 3]. */
export function toList(values: number[]): ListNode | null {
  const dummy = new ListNode();
  let curr = dummy;
  for (const v of values) {
    curr.next = new ListNode(v);
    curr = curr.next;
  }
  return dummy.next;
}

export function fromList(head: ListNode | null): number[] {
  const out: number[] = [];
  for (let n = head; n; n = n.next) out.push(n.val);
  return out;
}
