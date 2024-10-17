import { CI_RESP_COMPACT, VALID_DEVICES_TYPES } from "@/helper/constants";
import { log } from "@/helper/logger";
import type {
  ApplicationLayer,
  ApplicationLayerCompact,
  LinkLayer,
  MeterData,
  PrimaryVif,
  PrimaryVifString,
  WiredLinkLayer,
} from "@/types";

export function isWiredMbusFrame(data: Buffer) {
  return data[0] == 0x68 && data[3] == 0x68 && data[data.length - 1] == 0x16;
}

export function isLinkLayer(ll: LinkLayer | WiredLinkLayer): ll is LinkLayer {
  return (ll as LinkLayer).mField !== undefined;
}

export function isCompactFrame(
  apl: ApplicationLayer
): apl is ApplicationLayerCompact {
  return (apl as ApplicationLayerCompact).ci === CI_RESP_COMPACT;
}

export function isPrimaryVifString(vif: PrimaryVif): vif is PrimaryVifString {
  return (vif as PrimaryVifString).plainText !== undefined;
}

export function getMeterData(
  linkLayer: LinkLayer,
  applicationLayer?: ApplicationLayer
): MeterData {
  const linkLayerMeterData = {
    manufacturer: linkLayer.manufacturer,
    id: linkLayer.meterId,
    type: linkLayer.type,
    deviceType: getDeviceType(linkLayer.type),
    version: linkLayer.version,
  };

  if (applicationLayer?.ci == 0x7a) {
    return {
      ...linkLayerMeterData,
      status: applicationLayer.status,
      accessNo: applicationLayer.accessNo,
    };
  } else if (applicationLayer?.ci === 0x72) {
    return {
      manufacturer: applicationLayer.meterManufacturerString,
      id: applicationLayer.meterIdString,
      type: applicationLayer.meterDevice,
      deviceType: getDeviceType(applicationLayer.meterDevice),
      version: applicationLayer.meterVersion,
      status: applicationLayer.status,
      accessNo: applicationLayer.accessNo,
      radio: linkLayerMeterData,
    };
  } else {
    return linkLayerMeterData;
  }
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
  const lowPower = statusCode & 0b00000100;
  const permanentError = statusCode & 0b00001000;
  const temporaryError = statusCode & 0b00010000;
  const manufacturerSpecific = statusCode & 0b11100000;

  const suffix =
    (lowPower ? "; low power" : "") +
    (permanentError ? " (permanent)" : "") +
    (temporaryError ? " (temporary)" : "") +
    (manufacturerSpecific
      ? "; Manufacturer specific 0b" +
        manufacturerSpecific.toString(2).padStart(8, "0")
      : "");

  const bit01 = statusCode & 0b00000011;
  switch (bit01) {
    case 0x00:
      return "No error" + suffix;
    case 0x01:
      return "Busy" + suffix;
    case 0x02:
      return "Error" + suffix;
    case 0x03:
      return "Alarm" + suffix;
  }
}

// this assumes the telegram contains a local time and
// parses it with respect to the current timezone
export function decodeDateTimeTypeF(value: number) {
  // value is a 32bit int
  // z = daylight saving time?; v = valid?; r = reserved
  //   YYYY MMMM YYYD DDDD zrrh hhhh vrmm mmmm
  // 0b0001 0101 0001 1111 0011 0111 0011 0010 = 2008-05-31 23:50

  const valid = (value & 0x80) >> 8 === 0;
  if (!valid) {
    log.debug("Warning: Invalid date encountered!");
  }

  const minutes = value & 0x3f;
  const hours = (value & 0x1f00) >> 8;
  const day = (value & 0x1f0000) >> 16;
  const month = (value & 0x0f000000) >> 24;
  const year = ((value & 0xf0000000) >> 25) | ((value & 0xe00000) >> 21);
  return new Date(year + 2000, month - 1, day, hours, minutes, 0);
}

export function decodeDateTypeG(value: number) {
  // value is a 16bit int
  //   YYYY MMMM YYYD DDDD
  // 0b0000 1100 1111 1111 = 31.12.2007
  // 0b0000 0100 1111 1110 = 30.04.2007

  const day = value & 0x1f;
  const month = (value & 0x0f00) >> 8;
  const year = ((value & 0xf000) >> 9) | ((value & 0xe0) >> 5);
  return new Date(year + 2000, month - 1, day);
}

export function decodeDateTimeTypeI(value: number) {
  // value is a 48bit int - msb = 0x00 / unused
  //   YYYY MMMM YYYD DDDD WWWh hhhh 00mm mmmm 00ss ssss
  // 0b0010 0001 1110 1010 0100 1110 0001 0001 0011 1000 = 2023-01-10 14:17:56

  const buffer = Buffer.alloc(6);
  buffer.writeUIntLE(value, 0, 6);

  const seconds = buffer[0] & 0x3f;
  const minutes = buffer[1] & 0x3f;
  const hours = buffer[2] & 0x1f;
  const day = buffer[3] & 0x1f;
  const month = buffer[4] & 0x0f;
  const year = ((buffer[3] & 0xe0) >> 5) | ((buffer[4] & 0xf0) >> 1);
  return new Date(year + 2000, month - 1, day, hours, minutes, seconds);
}

export function decodeDateTypeTechem(value: number) {
  // value is a 16bit int

  //   YYYY YYYM MMMD DDDD
  // 0b0010 0101 1001 1111 = 31.12.2018

  const day = value & 0x1f;
  const month = (value & 0x1e0) >> 5;
  const year = (value & 0x7e00) >> 9;
  return new Date(year + 2000, month - 1, day);
}

export function decodeNoYearDateTypeTechem(value: number) {
  // value is a 16bit int
  //   rrrM MMMD DDDD rrrr
  // 0b0000 1100 1111 0000 = 15.06.

  const day = (value & 0x1f0) >> 4;
  const month = (value & 0x1e00) >> 9;
  const year = new Date().getFullYear();
  return new Date(year, month - 1, day);
}

export function decodeNoYearDateType2Techem(
  valueDay: number,
  valueMonth: number
) {
  const day = (valueDay & 0xf80) >> 7;
  const month = (valueMonth & 0x78) >> 3;
  const year = new Date().getFullYear();
  return new Date(year, month - 1, day);
}

export function encodeDateTypeG(date: Date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear() - 2000;

  const yearLSB = year & 0b111;
  const yearMSB = (year & 0b1111000) >> 3;

  //   YYYY MMMM YYYD DDDD
  // 0b0000 1100 1111 1111 = 31.12.2007
  // 0b0000 0100 1111 1110 = 30.04.2007

  return (yearMSB << 12) | (month << 8) | (yearLSB << 5) | day;
}
