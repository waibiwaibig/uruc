export function reconcilePersistedDestinationIds(
  current: string[],
  availableDestinationIds: Set<string>,
  destinationsReady: boolean,
): string[] {
  if (!destinationsReady) {
    return current;
  }

  const next = current.filter((id) => availableDestinationIds.has(id));
  return next.length === current.length ? current : next;
}
