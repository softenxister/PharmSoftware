import * as account from "@/app/api/account/route";
import * as changePassword from "@/app/api/auth/change-password/route";
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as setupOwner from "@/app/api/auth/setup-owner/route";
import * as currentUser from "@/app/api/current-user/route";
import * as ingredients from "@/app/api/ingredients/route";
import * as members from "@/app/api/members/route";
import * as memberAvatar from "@/app/api/members/avatar/route";
import * as preferences from "@/app/api/preferences/route";
import * as distributors from "@/app/api/distributors/route";
import * as purchaseCorrections from "@/app/api/purchase-corrections/route";
import * as purchase from "@/app/api/purchase/route";
import * as sales from "@/app/api/sales/route";
import * as salesReceipt from "@/app/api/sales/receipt/route";
import * as salesReceiptPdf from "@/app/api/sales/receipt/pdf/route";
import * as staff from "@/app/api/staff/route";
import * as stockAdjustments from "@/app/api/stock-adjustments/route";
import * as stockBatchAdjustments from "@/app/api/stock/batch-adjustments/route";
import * as stock from "@/app/api/stock/route";
import * as storePosSettings from "@/app/api/store-pos-settings/route";
import * as storeProfile from "@/app/api/store-profile/route";
import * as storeProfileImage from "@/app/api/store-profile/image/route";

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
  { method: "GET", path: "/api/store-pos-settings", handler: handler(storePosSettings.GET) },
  { method: "PATCH", path: "/api/store-pos-settings", handler: handler(storePosSettings.PATCH) },
  { method: "GET", path: "/api/store-profile", handler: handler(storeProfile.GET) },
  { method: "PATCH", path: "/api/store-profile", handler: handler(storeProfile.PATCH) },
  { method: "GET", path: "/api/store-profile/image", handler: handler(storeProfileImage.GET) },
  { method: "PUT", path: "/api/store-profile/image", handler: handler(storeProfileImage.PUT) },
];
