import {
  DIF_DATATYPE_INT8,
  DIF_DATATYPE_INT16,
  DIF_DATATYPE_INT24,
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

function getErrors(data: Buffer) {
  const errors = Buffer.alloc(2);

  //   const currentAlarms = {
  //     general: data[1] >> 7,
  //     leakage: data[2] >> 7,
  //     meterBlocked: data[2] >> 5 & 0x1,
  //     backflow: data[3] >> 7,
  //     underflow: data[3] >> 6 & 0x1,
  //     overflow: data[3] >> 5 & 0x1,
  //     submarine: data[3] >> 4 & 0x1,
  //     sensorFraud: data[3] >> 3 & 0x1,
  //     mechanicalFraud: data[3] >> 1 & 0x1
  // };
  // const previousAlarms = {
  //     leakage: data[2] >> 6 & 0x1,
  //     sensorFraud: data[3] >> 2 & 0x1,
  //     mechanicalFraud: data[3] & 0x1
  // };

  errors[0] |= data[3];
  errors[1] =
    (data[1] >> 7) |
    ((data[2] & 0x80) >> 6) |
    ((data[2] & 0x40) >> 4) |
    ((data[2] & 0x20) >> 2);

  //errors[1]: 0000dcba a = general; b = leakage; c = previousLeakage d = meterBlocked;
  //errors[0]: hgfedcba a = previousMechanicalFraud; b = mechanicalFraud;
  //                    c = previousSensorFraud; d = sensorFraud;
  //                    e = submarine; f = overflow; g = underflow; h = backflow

  return errors;
}

function createValidDataRecords(data: Buffer) {
  const result = Buffer.alloc(30);

  // total consumption
  result[0] = DIF_DATATYPE_INT8;
  result[1] = data[4];
  data.copy(result, 2, 6, 10);

  // last period consumption
  result[6] = DIF_DATATYPE_INT8 | 0x40; // storageNo = 1
  result[7] = data[4];
  data.copy(result, 8, 10, 14);

  // last period date
  result[12] = DIF_DATATYPE_INT16 | 0x40; // storageNo = 1
  result[13] = 0x6c;
  data.copy(result, 14, 14, 16);

  // remaining battery life
  result[16] = DIF_DATATYPE_INT8;
  result[17] = 0xff;
  result[18] = 0x6e; // like OPERATING_TIME_BATTERY in months
  result[19] = (data[2] & 0x1f) * 6;

  // transmit period
  result[20] = DIF_DATATYPE_INT24;
  result[21] = 0xff;
  result[22] = 0x2c; // like DURATION_SINCE_LAST_READ in seconds
  const period = 1 << ((data[1] & 0x0f) + 2);
  result.writeUIntLE(period, 23, 3);

  // alarms
  const errorFlags = getErrors(data);

  result[26] = DIF_DATATYPE_INT16;
  result[27] = 0xff;
  result[28] = 0x17; // like ERROR_FLAGS
  errorFlags.copy(result, 29);

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
  console.log(decryptedData.toString("hex"));

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
