import { Prisma } from "@server/generated/prisma/client";
import type { StockInventoryMetadata } from "../types";
import { prisma } from "../core/prisma";
import type { StockReadQuery } from "./stockReadQuery";
import {
  KY11_ANY_FORM_INGREDIENTS,
  KY11_SINGLE_CORTICOSTEROIDS,
  KY11_SINGLE_INGREDIENTS,
  type StockRegulatoryForm,
} from "@/lib/stockRegulatoryRecords";

export const totalStockSql = Prisma.sql`COALESCE(SUM(batch."availableStock"), 0)`;

const nearestExpirySql = Prisma.sql`
  MIN(
    CASE
      WHEN batch."expiryDate" ~ '^\\d{4}-\\d{2}-\\d{2}$'
        THEN TO_DATE(batch."expiryDate", 'YYYY-MM-DD')
      WHEN batch."expiryDate" ~ '^\\d{2}/\\d{2}/\\d{4}$'
        THEN TO_DATE(batch."expiryDate", 'DD/MM/YYYY')
      ELSE NULL
    END
  )
`;

function lowerValues(values: string[]): string[] {
  return values.map((value) => value.toLocaleLowerCase("en-US"));
}

function stockLevelCondition(level: string): Prisma.Sql {
  if (level === "Out of Stock") return Prisma.sql`${totalStockSql} <= 0`;
  if (level === "Low Stock") {
    return Prisma.sql`(${totalStockSql} > 0 AND ${totalStockSql} < product."minimumStock")`;
  }
  if (level === "Overstock") return Prisma.sql`${totalStockSql} > product."maximumStock"`;
  return Prisma.sql`(${totalStockSql} >= product."minimumStock" AND ${totalStockSql} <= product."maximumStock")`;
}

function expiryWindowCondition(window: string): Prisma.Sql {
  if (window === "No expiry date") return Prisma.sql`${nearestExpirySql} IS NULL`;
  if (window === "Expired") return Prisma.sql`${nearestExpirySql} < CURRENT_DATE`;
  if (window === "Within 30 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE AND CURRENT_DATE + 30`;
  }
  if (window === "31–90 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 90`;
  }
  if (window === "91–180 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE + 91 AND CURRENT_DATE + 180`;
  }
  if (window === "181–365 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE + 181 AND CURRENT_DATE + 365`;
  }
  return Prisma.sql`${nearestExpirySql} > CURRENT_DATE + 365`;
}

function hasRegulatedIngredient(
  names: readonly string[],
  source: "verified" | "imported",
): Prisma.Sql {
  const productIngredientTable = source === "verified"
    ? Prisma.sql`"ProductIngredient"`
    : Prisma.sql`"ProductImportedIngredient"`;
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM ${productIngredientTable} product_ingredient
    INNER JOIN "Ingredient" ingredient ON ingredient.id = product_ingredient."ingredientId"
    WHERE product_ingredient."productId" = product.id
      AND (${Prisma.join(names.map((name) => (
        Prisma.sql`(
          ingredient."normalizedName" ILIKE ${`%${name}%`}
          OR ingredient."canonicalName" ILIKE ${`%${name}%`}
          OR COALESCE(ingredient."thaiName", '') ILIKE ${`%${name}%`}
        )`
      )), " OR ")})
  )`;
}

function hasSingleRegulatedIngredient(
  names: readonly string[],
  source: "verified" | "imported",
): Prisma.Sql {
  const productIngredientTable = source === "verified"
    ? Prisma.sql`"ProductIngredient"`
    : Prisma.sql`"ProductImportedIngredient"`;
  const atomicIngredient = Prisma.sql`AND NOT EXISTS (
        SELECT 1 FROM ${productIngredientTable} atomic_link
        INNER JOIN "Ingredient" atomic_name ON atomic_name.id = atomic_link."ingredientId"
        WHERE atomic_link."productId" = product.id
          AND (
            atomic_name."canonicalName" ~ '[+,;/&|]'
            OR atomic_name."canonicalName" ~* '[[:space:]]+(and|และ)[[:space:]]+'
            OR COALESCE(atomic_name."thaiName", '') ~ '[+,;/&|]'
            OR COALESCE(atomic_name."thaiName", '') ~* '[[:space:]]+(and|และ)[[:space:]]+'
            ${source === "imported" ? Prisma.sql`
              OR atomic_link."sourceValue" ~ '[+,;/&|]'
              OR atomic_link."sourceValue" ~* '[[:space:]]+(and|และ)[[:space:]]+'
            ` : Prisma.empty}
          )
      )`;
  return Prisma.sql`(
    (SELECT COUNT(*) FROM ${productIngredientTable} ingredient_count
      WHERE ingredient_count."productId" = product.id) = 1
    ${atomicIngredient}
    AND ${hasRegulatedIngredient(names, source)}
  )`;
}

function ky11IngredientCondition(source: "verified" | "imported"): Prisma.Sql {
  return Prisma.sql`(
    ${hasRegulatedIngredient(KY11_ANY_FORM_INGREDIENTS, source)}
    OR ${hasSingleRegulatedIngredient([
      ...KY11_SINGLE_INGREDIENTS,
      ...KY11_SINGLE_CORTICOSTEROIDS,
    ], source)}
  )`;
}

function regulatoryFormCondition(form: StockRegulatoryForm): Prisma.Sql {
  if (form === "ข.ย. 9") return Prisma.sql`TRUE`;
  if (form === "ข.ย. 10") {
    return Prisma.sql`BTRIM(product."legalCategory") = 'ยาควบคุมพิเศษ'`;
  }
  return Prisma.sql`(
    (product."compositionStatus" = 'VERIFIED' AND ${ky11IngredientCondition("verified")})
    OR (product."compositionStatus" <> 'VERIFIED' AND ${ky11IngredientCondition("imported")})
  )`;
}

export function stockInventorySqlFilters(
  input: StockReadQuery,
): { where: Prisma.Sql[]; having: Prisma.Sql[] } {
  const where: Prisma.Sql[] = [Prisma.sql`product."isActive" = TRUE`];
  const having: Prisma.Sql[] = [];
  if (input.productIds.length > 0) {
    where.push(Prisma.sql`product.id IN (${Prisma.join(input.productIds)})`);
    return { where, having };
  }

  const { filters } = input;
  if (input.query) {
    const pattern = `%${input.query}%`;
    where.push(Prisma.sql`(
      product."itemName" ILIKE ${pattern}
      OR product."brandName" ILIKE ${pattern}
      OR product.barcode ILIKE ${pattern}
      OR product."externalProductCode" ILIKE ${pattern}
      OR manufacturer.name ILIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM "ProductBarcodeAlias" alias
        WHERE alias."productId" = product.id AND alias.barcode ILIKE ${pattern}
      )
      OR EXISTS (
        SELECT 1
        FROM "ProductParentPack" parent_pack
        LEFT JOIN "ProductBarcodeAlias" parent_alias ON parent_alias."parentPackId" = parent_pack.id
        WHERE parent_pack."productId" = product.id
          AND (parent_pack.barcode ILIKE ${pattern} OR parent_alias.barcode ILIKE ${pattern})
      )
    )`);
  }
  if (filters.categories.length > 0) {
    where.push(Prisma.sql`LOWER(category.name) IN (${Prisma.join(lowerValues(filters.categories))})`);
  }
  if (filters.legalCategories.length > 0) {
    where.push(Prisma.sql`LOWER(BTRIM(product."legalCategory")) IN (${Prisma.join(lowerValues(filters.legalCategories))})`);
  }
  if (filters.dosageTypes.length > 0) {
    where.push(Prisma.sql`LOWER(product."childUnit") IN (${Prisma.join(lowerValues(filters.dosageTypes))})`);
  }
  if (filters.manufacturers.length > 0) {
    where.push(Prisma.sql`LOWER(manufacturer.name) IN (${Prisma.join(lowerValues(filters.manufacturers))})`);
  }
  if (filters.tags.length > 0) {
    where.push(Prisma.sql`LOWER(product."tagName") IN (${Prisma.join(lowerValues(filters.tags))})`);
  }
  if (filters.regulatoryForms.length > 0) {
    where.push(Prisma.sql`(${Prisma.join(
      filters.regulatoryForms.map(regulatoryFormCondition),
      " OR ",
    )})`);
  }
  if (filters.stockLevels.length > 0) {
    having.push(Prisma.sql`(${Prisma.join(filters.stockLevels.map(stockLevelCondition), " OR ")})`);
  }
  if (filters.expiryWindows.length > 0) {
    having.push(Prisma.sql`(${Prisma.join(filters.expiryWindows.map(expiryWindowCondition), " OR ")})`);
  }
  if (filters.stockRange?.min !== null && filters.stockRange?.min !== undefined) {
    having.push(Prisma.sql`${totalStockSql} >= ${filters.stockRange.min}`);
  }
  if (filters.stockRange?.max !== null && filters.stockRange?.max !== undefined) {
    having.push(Prisma.sql`${totalStockSql} <= ${filters.stockRange.max}`);
  }
  return { where, having };
}

export function stockInventoryMetadataSql(input: StockReadQuery): Prisma.Sql {
  const { where, having } = stockInventorySqlFilters(input);
  return Prisma.sql`
    WITH filtered_products AS (
      SELECT
        product.id,
        product."legalCategory",
        product."childUnit" AS "dosageType",
        manufacturer.name AS manufacturer,
        product."tagName" AS tag,
        product."minimumStock",
        product."maximumStock",
        ${totalStockSql} AS "totalStock"
      FROM "Product" product
      INNER JOIN "Category" category ON category.id = product."categoryId"
      INNER JOIN "Manufacturer" manufacturer ON manufacturer.id = product."manufacturerId"
      LEFT JOIN "ProductBatch" batch ON batch."productId" = product.id
      WHERE ${Prisma.join(where, " AND ")}
      GROUP BY product.id, manufacturer.name
      ${having.length > 0 ? Prisma.sql`HAVING ${Prisma.join(having, " AND ")}` : Prisma.empty}
    )
    SELECT
      COALESCE(
        ARRAY_AGG(DISTINCT BTRIM(filtered_products."legalCategory"))
          FILTER (WHERE BTRIM(filtered_products."legalCategory") <> ''),
        ARRAY[]::text[]
      ) AS "legalCategories",
      COALESCE(
        ARRAY_AGG(DISTINCT filtered_products."dosageType")
          FILTER (WHERE BTRIM(filtered_products."dosageType") <> ''),
        ARRAY[]::text[]
      ) AS "dosageTypes",
      COALESCE(
        ARRAY_AGG(DISTINCT filtered_products.manufacturer)
          FILTER (WHERE BTRIM(filtered_products.manufacturer) <> ''),
        ARRAY[]::text[]
      ) AS manufacturers,
      COALESCE(
        ARRAY_AGG(DISTINCT filtered_products.tag)
          FILTER (WHERE BTRIM(filtered_products.tag) <> ''),
        ARRAY[]::text[]
      ) AS tags,
      COUNT(*) FILTER (
        WHERE filtered_products."totalStock" < filtered_products."minimumStock"
      )::integer AS "lowStock",
      COUNT(*) FILTER (
        WHERE filtered_products."totalStock" > filtered_products."maximumStock"
      )::integer AS overstock,
      COUNT(*)::integer AS total
    FROM filtered_products
  `;
}

type StockInventoryMetadataRow = {
  legalCategories: string[];
  dosageTypes: string[];
  manufacturers: string[];
  tags: string[];
  lowStock: number;
  overstock: number;
  total: number;
};

export async function readStockInventoryMetadata(
  input: StockReadQuery,
): Promise<{ inventory: StockInventoryMetadata; total: number }> {
  const [row] = await prisma.$queryRaw<StockInventoryMetadataRow[]>(
    stockInventoryMetadataSql(input),
  );
  return {
    inventory: {
      facets: {
        legalCategories: row?.legalCategories ?? [],
        dosageTypes: row?.dosageTypes ?? [],
        manufacturers: row?.manufacturers ?? [],
        tags: row?.tags ?? [],
      },
      counts: {
        lowStock: Number(row?.lowStock ?? 0),
        overstock: Number(row?.overstock ?? 0),
      },
    },
    total: Number(row?.total ?? 0),
  };
}
