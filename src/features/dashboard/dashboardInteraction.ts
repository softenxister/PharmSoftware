type HorizontalScroller = {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
};

type WheelMovement = {
  deltaX: number;
  deltaY: number;
};

export function scrollTimelineWithWheel(
  scroller: HorizontalScroller,
  movement: WheelMovement,
): boolean {
  const delta = Math.abs(movement.deltaX) > Math.abs(movement.deltaY)
    ? movement.deltaX
    : movement.deltaY;
  if (!delta) return false;

  const maximum = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const next = Math.min(maximum, Math.max(0, scroller.scrollLeft + delta));
  if (next === scroller.scrollLeft) return false;
  scroller.scrollLeft = next;
  return true;
}
