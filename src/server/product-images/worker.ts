import { runProductImageBatch } from "./repository";

const WORKER_INTERVAL_MS = 15 * 60 * 1_000;
const INITIAL_DELAY_MS = 5_000;
const WORKER_BATCH_SIZE = 5;

export function startProductImageWorker() {
  if (process.env.PRODUCT_IMAGE_WORKER_DISABLED === "true") return () => {};

  let running = false;
  let stopped = false;
  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await runProductImageBatch(WORKER_BATCH_SIZE);
    } catch (error) {
      console.error("Product image resolution failed", error);
    } finally {
      running = false;
    }
  };

  const initial = setTimeout(() => void run(), INITIAL_DELAY_MS);
  const interval = setInterval(() => void run(), WORKER_INTERVAL_MS);
  initial.unref?.();
  interval.unref?.();
  return () => {
    stopped = true;
    clearTimeout(initial);
    clearInterval(interval);
  };
}
