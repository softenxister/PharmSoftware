import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../src/server/db/prisma";
import {
  backfillHasRemainingCapacity,
  parseProductImageBackfillOptions,
} from "../src/server/product-images/backfill";
import {
  readProductImageStatusCounts,
  runProductImageBatch,
} from "../src/server/product-images/repository";

function timestampForFile(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function saveImageUrlBackup(directory: string): Promise<string> {
  const targetDirectory = path.resolve(directory);
  const products = await prisma.product.findMany({
    select: {
      id: true,
      barcode: true,
      itemName: true,
      brandName: true,
      imageUrl: true,
      imageResolutionStatus: true,
    },
    orderBy: { id: "asc" },
  });
  await fs.mkdir(targetDirectory, { recursive: true });
  const target = path.join(targetDirectory, `image-urls-${timestampForFile()}.json`);
  await fs.writeFile(target, `${JSON.stringify({
    createdAt: new Date().toISOString(),
    productCount: products.length,
    products,
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return target;
}

const options = parseProductImageBackfillOptions(process.argv.slice(2));
try {
  const total = await prisma.product.count({ where: { isActive: true } });
  const before = await readProductImageStatusCounts();
  console.log(JSON.stringify({
    mode: options.apply ? "apply" : "status",
    activeProducts: total,
    before,
    storageConfigured: Boolean(
      process.env.AWS_S3_REGION
      && process.env.AWS_S3_BUCKET
      && process.env.AWS_S3_ACCESS_KEY_ID
      && process.env.AWS_S3_SECRET_ACCESS_KEY
    ),
  }, null, 2));

  if (options.apply) {
    const backupPath = await saveImageUrlBackup(options.backupDirectory);
    console.log(`Saved image URL backup to ${backupPath}`);
    let processed = 0;
    while (backfillHasRemainingCapacity(processed, options)) {
      const batchSize = Math.min(options.batchSize, options.maxItems - processed);
      const batchProcessed = await runProductImageBatch(batchSize);
      if (batchProcessed === 0) break;
      processed += batchProcessed;
      console.log(`Processed ${processed} product image record${processed === 1 ? "" : "s"}.`);
    }
    console.log(JSON.stringify({
      processed,
      after: await readProductImageStatusCounts(),
    }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
