/**
 * Automated monitoring intentionally uses a count-only gate to control cost.
 * Equal-count swaps are not detected until a paid manual rescan.
 */
export function shouldRunAutomatedFollowingScan(
  storedFollowingCount: number,
  observedFollowingCount: number
): boolean {
  return storedFollowingCount !== observedFollowingCount;
}
