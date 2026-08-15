const SALES_AXIS_STEP = 500;
const SALES_AXIS_MAXIMUM = 3000;

export function buildSalesYAxis() {
  const maximum = SALES_AXIS_MAXIMUM;

  return {
    domain: [0, maximum] as [number, number],
    ticks: Array.from(
      { length: (maximum / SALES_AXIS_STEP) + 1 },
      (_, index) => index * SALES_AXIS_STEP,
    ),
  };
}
