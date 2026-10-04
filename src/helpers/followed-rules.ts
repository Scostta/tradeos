/**
 * Ticks / unticks a criterion on a trade's setup checklist. Always returns an
 * array: un-ticking the last criterion yields [] ("checklist recorded, nothing
 * met"), never null — null means "no checklist" and would leave the trade
 * ungraded instead of graded at the lowest grade.
 */
export function toggleFollowed(current: readonly string[] | null, id: string): string[] {
  const list = current ?? []
  return list.includes(id) ? list.filter(r => r !== id) : [...list, id]
}
