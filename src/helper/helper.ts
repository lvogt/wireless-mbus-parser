import { VALID_DEVICES_TYPES } from "@/helper/constants";
import type { LinkLayer, WiredLinkLayer } from "@/types";

export function isWiredMbusFrame(data: Buffer) {
  return data[0] == 0x68 && data[3] == 0x68 && data[data.length - 1] == 0x16;
}

export function isLinkLayer(ll: LinkLayer | WiredLinkLayer): ll is LinkLayer {
  return (ll as LinkLayer).mField !== undefined;
}

export function decodeBCD(digits: number, data: Buffer, offset = 0) {
  const length = Math.ceil(digits / 2);
  const bcdData = Buffer.from(data.subarray(offset, offset + length));

  // check for negative BCD
  const sign = bcdData[length - 1] >> 4 > 9 ? -1 : 1;
  if (sign === -1) {
    bcdData[length - 1] &= 0x0f;
  }

  let val = 0;
  for (let i = 0; i < length; i++) {
    val +=
      ((bcdData[i] & 0x0f) + ((bcdData[i] & 0xf0) >> 4) * 10) *
      Math.pow(100, i);
  }

  return Math.trunc(sign * val);
}

export function getMeterId(data: Buffer | number, offset = 0) {
  const num = Buffer.isBuffer(data) ? data.readUint32LE(offset) : data;
  return num.toString(16).padStart(8, "0");
}

export function decodeManufacturer(data: number) {
  return (
    String.fromCharCode((data >> 10) + 64) +
    String.fromCharCode(((data >> 5) & 0x1f) + 64) +
    String.fromCharCode((data & 0x1f) + 64)
  );
}

export function getDeviceType(type: number) {
  const idx = type as keyof typeof VALID_DEVICES_TYPES;
  return VALID_DEVICES_TYPES[idx] || "unknown";
}

export function getDeviceState(statusCode: number) {
  switch (statusCode) {
    case 0x00:
      return "No error";
    case 0x01:
      return "Application busy";
    case 0x02:
      return "Any application error";
    case 0x03:
      return "Abnormal condition / Alarm";
    default:
      return `Error state 0x${statusCode.toString(16)}`;
  }
}
