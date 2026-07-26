export function shouldCloseDropdown(container: HTMLElement | null, target: Node): boolean {
  return container !== null && !container.contains(target);
}
