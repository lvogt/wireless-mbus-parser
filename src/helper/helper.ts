import { VALID_DEVICES_TYPES } from "@/helper/constants";

export function isWiredMbusFrame(data: Buffer) {
  return data[0] == 0x68 && data[3] == 0x68 && data[data.length - 1] == 0x16;
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

export function getMeterId(data: Buffer, offset: number) {
  const bcd = decodeBCD(8, data, offset);
  return bcd.toString().padStart(8, "0");
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
