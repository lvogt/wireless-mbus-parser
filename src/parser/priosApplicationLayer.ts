import {
  DIF_DATATYPE_INT16,
  DIF_DATATYPE_INT24,
  DIF_DATATYPE_INT32,
  DIF_DATATYPE_VARLEN,
} from "@/helper/constants";
import { getDeviceType, getMeterId, isLinkLayer } from "@/helper/helper";
import type {
  ApplicationLayer,
  ApplicationLayerPrios,
  LinkLayer,
  ParserState,
  WiredLinkLayer,
} from "@/types";

const KEY_1 = Buffer.from("39BC8A10E66D83F8", "hex");
const KEY_2 = Buffer.from("51728910E66D83F8", "hex");

function fixLinkLayer(linkLayer: LinkLayer): LinkLayer {
  const version = linkLayer.addressRaw[2];
  const type = linkLayer.addressRaw[3];
  const versionAndType = Buffer.alloc(2);
  versionAndType.writeUInt8(version, 0);
  versionAndType.writeUInt8(type, 1);

  const addressRaw = Buffer.concat([
    linkLayer.addressRaw.subarray(0, 2),
    linkLayer.addressRaw.subarray(4),
    Buffer.from(versionAndType),
  ]);

  return {
    lField: linkLayer.lField,
    cField: linkLayer.cField,
    mField: linkLayer.mField,
    aField: addressRaw.readUInt32LE(2),
    version: version,
    type: type,

    addressRaw: addressRaw,
    aFieldRaw: addressRaw.subarray(2),

    manufacturer: linkLayer.manufacturer,
    typeString: getDeviceType(type),
    meterId: getMeterId(addressRaw, 2),
  };
}

function prepareKey(
  key: Buffer,
  rawAddress: Buffer,
  data: Buffer,
  pos: number
) {
  return (
    (key.readUint32BE(0) ^
      key.readUint32BE(4) ^
      rawAddress.readUint32BE(0) ^
      rawAddress.readUint32BE(4) ^
      data.readUint32BE(pos)) >>>
    0
  );
}

function rotateKey(key: number) {
  const bit =
    +((key & 0x2) != 0) ^
    +((key & 0x4) != 0) ^
    +((key & 0x80000000) != 0) ^
    +((key & 0x800) != 0);
  return (key << 1) | bit;
}

function checkKey(key: number, data: Buffer, pos: number) {
  for (let i = 0; i < 8; i++) {
    key = rotateKey(key);
  }
  const check = data[pos + 5] ^ (key & 0xff);
  return check === 0x4b;
}

function getKey(rawAddress: Buffer, data: Buffer, pos: number) {
  const preparedKey1 = prepareKey(KEY_1, rawAddress, data, pos);
  if (checkKey(preparedKey1, data, pos)) {
    return preparedKey1;
  } else {
    const preparedKey2 = prepareKey(KEY_2, rawAddress, data, pos);
    if (checkKey(preparedKey2, data, pos)) {
      return preparedKey2;
    } else {
      throw new Error("No matching key to decrypt PRIOS telegram found!");
    }
  }
}

function decrypt(key: number, data: Buffer, pos: number) {
  const decryptedData = Buffer.alloc(data.length - pos);
  data.copy(decryptedData, 0, pos, pos + 10);

  for (let i = pos + 5; i < data.length; i++) {
    for (let j = 0; j < 8; j++) {
      key = rotateKey(key);
    }
    decryptedData[i - pos] = data[i] ^ (key & 0xff);
  }

  return decryptedData;
}

function getAlarmsAsString(alarms: Record<string, boolean>) {
  const result = Object.keys(alarms).reduce((prev, current) => {
    if (alarms[current]) {
      const formattedName = current.replace(
        /[A-Z]/,
        (c) => ` ${c.toLowerCase()}`
      );
      if (prev) {
        return `${prev}, ${formattedName}`;
      } else {
        return formattedName;
      }
    }
    return prev;
  }, "");

  return result.length ? result : "no alarms";
}

function getErrors(data: Buffer) {
  const currentAlarms = {
    general: (data[1] & 0b10000000) !== 0,
    leakage: (data[2] & 0b10000000) !== 0,
    meterBlocked: (data[2] & 0b100000) !== 0,
    backflow: (data[3] & 0b10000000) !== 0,
    underflow: (data[3] & 0b1000000) !== 0,
    overflow: (data[3] & 0b100000) !== 0,
    submarine: (data[3] & 0b10000) !== 0,
    sensorFraud: (data[3] & 0b1000) !== 0,
    mechanicalFraud: (data[3] & 0b10) !== 0,
  };

  const currentString = getAlarmsAsString(currentAlarms);

  const previousAlarms = {
    leakage: (data[2] & 0b1000000) !== 0,
    sensorFraud: (data[3] & 0b100) !== 0,
    mechanicalFraud: (data[3] & 0b1) !== 0,
  };

  const previousString = getAlarmsAsString(previousAlarms);

  return {
    current: currentString,
    previous: previousString,
  };
}

function createValidDataRecords(data: Buffer) {
  const errorFlags = getErrors(data);

  const result = Buffer.alloc(
    36 + errorFlags.current.length + errorFlags.previous.length
  );

  let i = 0;

  // total consumption
  result[i++] = DIF_DATATYPE_INT32;
  result[i++] = data[4];
  data.copy(result, i, 6, 10);
  i += 4;

  // last period consumption
  result[i++] = DIF_DATATYPE_INT32 | 0x40; // storageNo = 1
  result[i++] = data[4];
  data.copy(result, i, 10, 14);
  i += 4;

  // last period date
  result[i++] = DIF_DATATYPE_INT16 | 0x40; // storageNo = 1
  result[i++] = 0x6c;
  data.copy(result, i, 14, 16);
  i += 2;

  // remaining battery life
  result[i++] = DIF_DATATYPE_INT16;
  result[i++] = 0xff;
  result[i++] = 0x6e; // like OPERATING_TIME_BATTERY in months
  const remainingMonths = (data[2] & 0x1f) * 6;
  result.writeUInt16LE(remainingMonths, i);
  i += 2;

  // transmit period
  result[i++] = DIF_DATATYPE_INT24;
  result[i++] = 0xff;
  result[i++] = 0x2c; // like DURATION_SINCE_LAST_READ in seconds
  const period = 1 << ((data[1] & 0x0f) + 2);
  result.writeUIntLE(period, i, 3);
  i += 3;

  // alarms
  result[i++] = DIF_DATATYPE_VARLEN;
  result[i++] = 0xff;
  result[i++] = 0x17; // like ERROR_FLAGS
  result[i++] = errorFlags.current.length;
  result.write(errorFlags.current.split("").reverse().join(""), i, "ascii");
  i += errorFlags.current.length;

  result[i++] = DIF_DATATYPE_VARLEN;
  result[i++] = 0xff;
  result[i++] = 0x17 | 0x80; // like ERROR_FLAGS
  result[i++] = 0x3e; // reserved VIFE = previous value
  result[i++] = errorFlags.previous.length;
  result.write(errorFlags.previous.split("").reverse().join(""), i, "ascii");

  return result;
}

export async function decodePriosApplicationLayer(
  data: Buffer,
  pos: number,
  linkLayer: LinkLayer | WiredLinkLayer
): Promise<{
  state: ParserState;
  applicationLayer: ApplicationLayer;
  linkLayer: LinkLayer;
}> {
  if (!isLinkLayer(linkLayer)) {
    throw new Error("PRIOS telegram without full link layer!");
  }

  const key = getKey(linkLayer.addressRaw, data, pos);
  const decryptedData = decrypt(key, data, pos);

  const rawDataRecords = createValidDataRecords(decryptedData);
  const fixedData = Buffer.concat([data.subarray(0, pos), rawDataRecords]);

  const apl: ApplicationLayerPrios = {
    ci: data[pos] as ApplicationLayerPrios["ci"],
    offset: pos,
  };

  return {
    state: {
      data: fixedData,
      pos: pos + 1,
    },
    applicationLayer: apl,
    linkLayer: fixLinkLayer(linkLayer),
  };
}
