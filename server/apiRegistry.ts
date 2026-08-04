import * as account from "./routes/account";
import * as changePassword from "./routes/auth/changePassword";
import * as login from "./routes/auth/login";
import * as logout from "./routes/auth/logout";
import * as setupOwner from "./routes/auth/setupOwner";
import * as currentUser from "./routes/currentUser";
import * as distributors from "./routes/distributors";
import * as ingredients from "./routes/ingredients";
import * as memberAvatar from "./routes/memberAvatar";
import * as members from "./routes/members";
import * as preferences from "./routes/preferences";
import * as productImages from "./routes/productImages";
import * as purchase from "./routes/purchase";
import * as purchaseCorrections from "./routes/purchaseCorrections";
import * as sales from "./routes/sales";
import * as salesReceipt from "./routes/salesReceipt";
import * as salesReceiptPdf from "./routes/salesReceiptPdf";
import * as staff from "./routes/staff";
import * as stock from "./routes/stock";
import * as stockAdjustments from "./routes/stockAdjustments";
import * as stockBatchAdjustments from "./routes/stockBatchAdjustments";
import * as distributorDataMigration from "./routes/stockMigrations/distributors";
import * as cwStockMigration from "./routes/stockMigrations/cwStock";
import * as lotExpiryMigration from "./routes/stockMigrations/lotExpiry";
import * as memberDataMigration from "./routes/stockMigrations/members";
import * as productCategoryNormalization from "./routes/stockMigrations/productCategories";
import * as productMeasurementNormalization from "./routes/stockMigrations/productMeasurements";
import * as stockPhotos from "./routes/stockPhotos";
import * as stockPhotoUrl from "./routes/stockPhotoUrl";
import * as storePosSettings from "./routes/storePosSettings";
import * as storeProfile from "./routes/storeProfile";
import * as storeProfileImage from "./routes/storeProfileImage";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ApiHandler = (request: Request) => Response | Promise<Response>;

export type ApiRoute = {
  method: ApiMethod;
  path: `/api/${string}`;
  handler: ApiHandler;
};

const handler = (routeHandler: (request?: Request) => Response | Promise<Response>): ApiHandler => (
  request,
) => routeHandler(request);

export const apiRoutes: readonly ApiRoute[] = [
  { method: "GET", path: "/api/account", handler: handler(account.GET) },
  { method: "PATCH", path: "/api/account", handler: handler(account.PATCH) },
  { method: "POST", path: "/api/auth/change-password", handler: handler(changePassword.POST) },
  { method: "POST", path: "/api/auth/login", handler: handler(login.POST) },
  { method: "POST", path: "/api/auth/logout", handler: handler(logout.POST) },
  { method: "GET", path: "/api/auth/setup-owner", handler: handler(setupOwner.GET) },
  { method: "POST", path: "/api/auth/setup-owner", handler: handler(setupOwner.POST) },
  { method: "GET", path: "/api/current-user", handler: handler(currentUser.GET) },
  { method: "GET", path: "/api/ingredients", handler: handler(ingredients.GET) },
  { method: "GET", path: "/api/members", handler: handler(members.GET) },
  { method: "GET", path: "/api/members/avatar", handler: handler(memberAvatar.GET) },
  { method: "POST", path: "/api/members", handler: handler(members.POST) },
  { method: "PATCH", path: "/api/members", handler: handler(members.PATCH) },
  { method: "GET", path: "/api/preferences", handler: handler(preferences.GET) },
  { method: "PATCH", path: "/api/preferences", handler: handler(preferences.PATCH) },
  { method: "GET", path: "/api/product-images/:productId", handler: handler(productImages.GET) },
  { method: "GET", path: "/api/distributors", handler: handler(distributors.GET) },
  { method: "GET", path: "/api/purchase-corrections", handler: handler(purchaseCorrections.GET) },
  { method: "POST", path: "/api/purchase-corrections", handler: handler(purchaseCorrections.POST) },
  { method: "PATCH", path: "/api/purchase-corrections", handler: handler(purchaseCorrections.PATCH) },
  { method: "GET", path: "/api/purchase", handler: handler(purchase.GET) },
  { method: "POST", path: "/api/purchase", handler: handler(purchase.POST) },
  { method: "PUT", path: "/api/purchase", handler: handler(purchase.PUT) },
  { method: "GET", path: "/api/sales", handler: handler(sales.GET) },
  { method: "POST", path: "/api/sales", handler: handler(sales.POST) },
  { method: "GET", path: "/api/sales/receipt", handler: handler(salesReceipt.GET) },
  { method: "GET", path: "/api/sales/receipt/pdf", handler: handler(salesReceiptPdf.GET) },
  { method: "GET", path: "/api/staff", handler: handler(staff.GET) },
  { method: "POST", path: "/api/staff", handler: handler(staff.POST) },
  { method: "PATCH", path: "/api/staff", handler: handler(staff.PATCH) },
  { method: "POST", path: "/api/stock-adjustments", handler: handler(stockAdjustments.POST) },
  { method: "POST", path: "/api/stock/batch-adjustments", handler: handler(stockBatchAdjustments.POST) },
  { method: "GET", path: "/api/stock", handler: handler(stock.GET) },
  { method: "POST", path: "/api/stock", handler: handler(stock.POST) },
  { method: "PATCH", path: "/api/stock", handler: handler(stock.PATCH) },
  { method: "DELETE", path: "/api/stock", handler: handler(stock.DELETE) },
  {
    method: "POST",
    path: "/api/stock/migrations/categories",
    handler: handler(productCategoryNormalization.POST),
  },
  {
    method: "POST",
    path: "/api/stock/migrations/measurements",
    handler: handler(productMeasurementNormalization.POST),
  },
  { method: "PATCH", path: "/api/stock/photo-url", handler: handler(stockPhotoUrl.PATCH) },
  { method: "POST", path: "/api/stock/photos", handler: handler(stockPhotos.POST) },
  { method: "PUT", path: "/api/stock/photos/:productId", handler: handler(stockPhotos.PUT) },
  { method: "POST", path: "/api/stock/migrations/cw", handler: handler(cwStockMigration.POST) },
  { method: "POST", path: "/api/stock/migrations/lots", handler: handler(lotExpiryMigration.POST) },
  { method: "POST", path: "/api/stock/migrations/distributors", handler: handler(distributorDataMigration.POST) },
  { method: "POST", path: "/api/stock/migrations/members", handler: handler(memberDataMigration.POST) },
  { method: "GET", path: "/api/store-pos-settings", handler: handler(storePosSettings.GET) },
  { method: "PATCH", path: "/api/store-pos-settings", handler: handler(storePosSettings.PATCH) },
  { method: "GET", path: "/api/store-profile", handler: handler(storeProfile.GET) },
  { method: "PATCH", path: "/api/store-profile", handler: handler(storeProfile.PATCH) },
  { method: "GET", path: "/api/store-profile/image", handler: handler(storeProfileImage.GET) },
  { method: "PUT", path: "/api/store-profile/image", handler: handler(storeProfileImage.PUT) },
];
