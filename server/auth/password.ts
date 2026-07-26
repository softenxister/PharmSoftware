import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

async function deriveKey(password: string, salt: Buffer, cost: number, blockSize: number, parallelization: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, {
      cost,
      blockSize,
      parallelization,
      maxmem: MAX_MEMORY,
    }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, COST, BLOCK_SIZE, PARALLELIZATION);
  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  try {
    const [algorithm, costValue, blockSizeValue, parallelizationValue, saltValue, keyValue, ...rest] = encodedHash.split("$");
    if (algorithm !== "scrypt" || rest.length > 0 || !saltValue || !keyValue) return false;
    const cost = Number(costValue);
    const blockSize = Number(blockSizeValue);
    const parallelization = Number(parallelizationValue);
    if (cost !== COST || blockSize !== BLOCK_SIZE || parallelization !== PARALLELIZATION) return false;
    const salt = Buffer.from(saltValue, "base64url");
    const expectedKey = Buffer.from(keyValue, "base64url");
    if (salt.length !== 16 || expectedKey.length !== KEY_LENGTH) return false;
    const actualKey = await deriveKey(password, salt, cost, blockSize, parallelization);
    return timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}
