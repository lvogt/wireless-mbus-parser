import {
  type CipherGCMTypes,
  type CipherOCBTypes,
  createDecipheriv,
} from "crypto";

import { log } from "@/helper/logger";

export function decryptData(
  encryptedData: Buffer,
  iv: Buffer,
  key: Buffer,
  algorithm: CipherGCMTypes | CipherGCMTypes | CipherOCBTypes | string
) {
  const padding = encryptedData.length % 16;
  const length = encryptedData.length;

  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAutoPadding(false);

  if (padding) {
    encryptedData = Buffer.concat([encryptedData, Buffer.alloc(16 - padding)]);
  }

  const decryptedData = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decryptedData.subarray(0, length);
}

export function decryptInPlace(
  data: Buffer,
  key: Buffer,
  iv: Buffer,
  algorithm: string,
  offset: number,
  length: number
) {
  const encryptedData = data.subarray(offset, offset + length);
  log.debug(`Encrypted data: ${encryptedData.toString("hex")}`);
  log.debug(`IV: ${iv.toString("hex")}`);
  const decryptedData = decryptData(encryptedData, iv, key, algorithm);

  log.debug(`Decrypted data: ${decryptedData.toString("hex")}`);
  if (!decryptedData.length) {
    throw new Error(
      `Decryption (${algorithm}) failed! IV: ${iv.toString("hex")}`
    );
  }

  return Buffer.concat([
    data.subarray(0, offset),
    decryptedData,
    data.subarray(offset + length),
  ]);
}
