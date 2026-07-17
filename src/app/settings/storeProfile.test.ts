import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_STORE_PROFILE,
  parseStoreProfileUpdate,
  validateStoreProfileImage,
} from "./storeProfile";

test("store profile accepts trimmed contact and social details", () => {
  assert.deepEqual(parseStoreProfileUpdate({
    storeName: "  RxPro Pharmacy  ",
    phone: " 02 123 4567 ",
    email: " owner@example.com ",
    taxId: " 0105550000000 ",
    pharmacyLicense: " PH-001 ",
    address: " 1 Pharmacy Road ",
    lineId: " @rxpro ",
    facebookPage: " https://facebook.com/rxpro ",
    openingTime: " 09:00 ",
    closingTime: " 20:00 ",
  }), {
    storeName: "RxPro Pharmacy",
    phone: "02 123 4567",
    email: "owner@example.com",
    taxId: "0105550000000",
    pharmacyLicense: "PH-001",
    address: "1 Pharmacy Road",
    lineId: "@rxpro",
    facebookPage: "https://facebook.com/rxpro",
    openingTime: "09:00",
    closingTime: "20:00",
    imageUrl: null,
  });
});

test("store profile rejects missing names, invalid email, and oversized fields", () => {
  assert.equal(parseStoreProfileUpdate({ ...EMPTY_STORE_PROFILE, storeName: "" }), null);
  assert.equal(parseStoreProfileUpdate({ ...EMPTY_STORE_PROFILE, storeName: "RxPro", email: "invalid" }), null);
  assert.equal(parseStoreProfileUpdate({ ...EMPTY_STORE_PROFILE, storeName: "RxPro", lineId: "x".repeat(101) }), null);
  assert.equal(parseStoreProfileUpdate({ ...EMPTY_STORE_PROFILE, storeName: "RxPro", openingTime: "9am" }), null);
});

test("store profile image validation checks type, size, and file signature", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(validateStoreProfileImage(png, "image/png"), null);
  assert.equal(validateStoreProfileImage(jpeg, "image/jpeg"), null);
  assert.equal(validateStoreProfileImage(webp, "image/webp"), null);
  assert.equal(validateStoreProfileImage(png, "image/jpeg"), "Image content does not match its file type.");
  assert.equal(validateStoreProfileImage(new Uint8Array(0), "image/png"), "Choose a non-empty image.");
  assert.equal(validateStoreProfileImage(new Uint8Array(1024 * 1024 + 1), "image/png"), "Image must be 1 MB or smaller.");
});
