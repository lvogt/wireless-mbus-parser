import { AesCmac } from "aes-cmac";
import {
  type CipherGCMTypes,
  type CipherOCBTypes,
  createDecipheriv,
} from "crypto";

import { CI_RESP_12 } from "@/helper/constants";
import { ParserError } from "@/helper/error";
import { log } from "@/helper/logger";
import type {
  ApplicationLayer,
  AuthenticationAndFragmentationLayer,
  LinkLayer,
} from "@/types";

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
    throw new ParserError(
      "DECRYPTION_ERROR",
      `Decryption (${algorithm}) failed! IV: ${iv.toString("hex")}`
    );
  }

  return Buffer.concat([
    data.subarray(0, offset),
    decryptedData,
    data.subarray(offset + length),
  ]);
}

export async function calcKenc(
  key: Buffer,
  layers: {
    ll: LinkLayer;
    afl: AuthenticationAndFragmentationLayer;
    apl: ApplicationLayer;
  }
): Promise<{ kenc: Buffer; kmac: Buffer }> {
  if (layers.afl.mcr === undefined) {
    throw new ParserError(
      "DECRYPTION_ERROR",
      "Cannot dervice Kenc without MCR from AFL!"
    );
  }

  const msg = Buffer.alloc(16, 0x07);
  msg[0] = 0x00; // derivation constant (see. 9.5.3) 00 = Kenc (from meter) 01 = Kmac (from meter)
  msg.writeUInt32LE(layers.afl.mcr, 1);

  if (layers.apl.ci === CI_RESP_12) {
    msg.writeUInt32LE(layers.apl.meterId, 5);
  } else {
    msg.writeUInt32LE(layers.ll.aField, 5);
  }

  const cmac = new AesCmac(key);
  const kenc = Buffer.from(await cmac.calculate(msg));

  log.debug(`Kenc: ${kenc.toString("hex")}`);

  msg[0] = 0x01; // derivation constant
  const kmac = Buffer.from(await cmac.calculate(msg));
  log.debug(`Kmac: ${kmac.toString("hex")}`);

  return { kenc, kmac };
}

export async function checkAflMac(
  kmac: Buffer,
  msgData: Buffer,
  afl: AuthenticationAndFragmentationLayer
) {
  const msgStart = Buffer.alloc(5 + (afl.fcl.mlp ? 2 : 0));
  msgStart[0] = afl.mclRaw;
  msgStart.writeUInt32LE(afl.mcr, 1);
  if (afl.fcl.mlp) {
    msgStart.writeUInt16LE(afl.ml, 5);
  }

  const msg = Buffer.concat([msgStart, msgData]);
  const cmac = await new AesCmac(kmac);
  const mac = Buffer.from(await cmac.calculate(msg));

  log.debug(`MAC: ${mac.toString("hex")}`);
  if (afl.mac.compare(mac.subarray(0, 8)) != 0) {
    throw new ParserError(
      "WRONG_AES_KEY",
      `Received MAC does not match. Wrong key?\nMAC received: ${afl.mac.toString("hex")}`
    );
  }
}
