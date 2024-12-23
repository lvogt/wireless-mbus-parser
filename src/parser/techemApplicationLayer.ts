import {
  DIF_DATATYPE_INT16,
  DIF_DATATYPE_INT24,
  DIF_DATATYPE_INT32,
  DIF_DATATYPE_VARLEN,
} from "@/helper/constants";
import {
  decodeDateTypeTechem,
  decodeNoYearDateType2Techem,
  decodeNoYearDateTypeTechem,
  encodeDateTypeG,
} from "@/helper/helper";
import type {
  ApplicationLayer,
  ApplicationLayerDummy,
  LinkLayer,
  ParserState,
} from "@/types";

enum TCHDeviceType {
  HCA,
  Heat,
  Water,
  Smoke,
}

const HCA_VERSIONS = [0x61, 0x64, 0x69, 0x94];

function checkType(type: number): TCHDeviceType {
  switch (type) {
    case 0x62: // Hot water meter
    case 0x72: // Cold water meter
      return TCHDeviceType.Water;

    case 0x43: //Heat meter
    case 0x45: //Heat meter ???
      return TCHDeviceType.Heat;

    case 0x80: //Heat cost allocator
      return TCHDeviceType.HCA;

    case 0xf0: //Smoke detector
      return TCHDeviceType.Smoke;

    default:
      throw new Error(`Unkown Techem device type! 0x${type.toString(16)}`);
  }
}

function createValidDataRecordsHca(data: Buffer, pos: number, version: number) {
  if (!HCA_VERSIONS.includes(version)) {
    throw new Error(`Unknown TCH HCA version 0x${version.toString(16)}`);
  }

  const neededLength = version == 0x94 ? 15 : version == 0x69 ? 14 : 10;

  if (pos + neededLength > data.length) {
    throw new Error("Telegram to short for TCH HCA coding!");
  }

  const result = Buffer.alloc(29);
  let i = 0;

  //last period date
  const lastDate = encodeDateTypeG(
    decodeDateTypeTechem(data.readUInt16LE(pos + 2))
  );

  result[i++] = DIF_DATATYPE_INT16 | 0x40; // storageNo = 1
  result[i++] = 0x6c;
  result.writeUInt16LE(lastDate, i);
  i += 2;

  //last period hca
  result[i++] = DIF_DATATYPE_INT16 | 0x40; // storageNo = 1
  result[i++] = 0x6e;
  result[i++] = data[pos + 4];
  result[i++] = data[pos + 5];

  //current date
  const currentDate = encodeDateTypeG(
    decodeNoYearDateTypeTechem(data.readUInt16LE(pos + 6))
  );

  result[i++] = DIF_DATATYPE_INT16;
  result[i++] = 0x6c;
  result.writeUInt16LE(currentDate, i);
  i += 2;

  //current hca
  result[i++] = DIF_DATATYPE_INT16;
  result[i++] = 0x6e;
  result[i++] = data[pos + 8];
  result[i++] = data[pos + 9];

  if (version != 0x94 && version != 0x69) {
    return result.subarray(0, 16);
  }

  const dataOffset = version === 0x94 ? pos + 11 : pos + 10;

  //temperature 1
  const temp1 = data.readUint16LE(dataOffset);
  result[i++] = DIF_DATATYPE_INT16;
  result[i++] = 0x65;
  result[i++] = data[dataOffset];
  result[i++] = data[dataOffset + 1];

  //temperature 2
  const temp2 = data.readUint16LE(dataOffset + 2);
  result[i++] = DIF_DATATYPE_INT16;
  result[i++] = 0x65;
  result[i++] = data[dataOffset + 2];
  result[i++] = data[dataOffset + 3];

  //difference
  const diff = temp1 - temp2;
  result[i++] = DIF_DATATYPE_VARLEN;
  result[i++] = 0x61;
  result[i++] = 0xe2; //binary number; 2 bytes
  result.writeInt16LE(diff, i);
  i += 2;

  return result;
}

function createValidDataRecordsWater(data: Buffer, pos: number) {
  const result = Buffer.alloc(21);
  let i = 0;

  //last period date
  const lastDate = encodeDateTypeG(
    decodeDateTypeTechem(data.readUInt16LE(pos + 2))
  );

  result[i++] = DIF_DATATYPE_INT16 | 0x40; // storageNo = 1
  result[i++] = 0x6c;
  result.writeUInt16LE(lastDate, i);
  i += 2;

  //last period volume
  result[i++] = DIF_DATATYPE_INT16 | 0x40; // storageNo = 1
  result[i++] = 0x15; // 0.1 m³
  result[i++] = data[pos + 4];
  result[i++] = data[pos + 5];
  const lastPeriod = data.readUint16LE(pos + 4);

  //current date
  const currentDate = encodeDateTypeG(
    decodeNoYearDateTypeTechem(data.readUInt16LE(pos + 6))
  );

  result[i++] = DIF_DATATYPE_INT16;
  result[i++] = 0x6c;
  result.writeUInt16LE(currentDate, i);
  i += 2;

  //current volume
  result[i++] = DIF_DATATYPE_INT16;
  result[i++] = 0x15; // 0.1 m³
  result[i++] = data[pos + 8];
  result[i++] = data[pos + 9];
  const currentPeriod = data.readUint16LE(pos + 8);

  // total
  result[i++] = DIF_DATATYPE_INT24;
  result[i++] = 0x15; // 0.1 m³
  result.writeUIntLE(currentPeriod + lastPeriod, i, 3);

  return result;
}

function createValidDataRecordsHeat(data: Buffer, pos: number) {
  const result = Buffer.alloc(24);
  let i = 0;

  //last period date
  const lastDate = encodeDateTypeG(
    decodeDateTypeTechem(data.readUInt16LE(pos + 2))
  );

  result[i++] = DIF_DATATYPE_INT16 | 0x40; // storageNo = 1
  result[i++] = 0x6c;
  result.writeUInt16LE(lastDate, i);
  i += 2;

  //last period energy
  result[i++] = DIF_DATATYPE_INT24 | 0x40; // storageNo = 1
  result[i++] = 0x06; // 1 kWh
  result[i++] = data[pos + 4];
  result[i++] = data[pos + 5];
  result[i++] = data[pos + 6];
  const lastPeriod = data.readUintLE(pos + 4, 3);

  //current date
  const currentDate = encodeDateTypeG(
    decodeNoYearDateType2Techem(
      data.readUInt8(pos + 11),
      data.readInt8(pos + 7)
    )
  );

  result[i++] = DIF_DATATYPE_INT16;
  result[i++] = 0x6c;
  result.writeUInt16LE(currentDate, i);
  i += 2;

  //current energy
  result[i++] = DIF_DATATYPE_INT24;
  result[i++] = 0x06; // 1 kWh
  result[i++] = data[pos + 8];
  result[i++] = data[pos + 9];
  result[i++] = data[pos + 10];
  const currentPeriod = data.readUint16LE(pos + 8);

  // total
  result[i++] = DIF_DATATYPE_INT32;
  result[i++] = 0x06; // 1 kWh
  result.writeUInt32LE(currentPeriod + lastPeriod, i);

  return result;
}

function createValidDataRecords(
  type: TCHDeviceType,
  data: Buffer,
  pos: number,
  version: number
): Buffer {
  switch (type) {
    case TCHDeviceType.HCA:
      return createValidDataRecordsHca(data, pos, version);
    case TCHDeviceType.Water:
      return createValidDataRecordsWater(data, pos);
    case TCHDeviceType.Heat:
      return createValidDataRecordsHeat(data, pos);
    default:
      throw new Error("Not yet implemented!");
  }
}

export function decodeTechemApplicationLayer(
  state: ParserState,
  linkLayer: LinkLayer
): {
  state: ParserState;
  applicationLayer: ApplicationLayer;
  linkLayer: LinkLayer;
} {
  const { pos, data } = state;
  const tchDevice = checkType(linkLayer.type);
  const rawDataRecords = createValidDataRecords(
    tchDevice,
    data,
    pos,
    linkLayer.version
  );
  const fixedData = Buffer.concat([data.subarray(0, pos), rawDataRecords]);
  const apl: ApplicationLayerDummy = {
    ci: data[pos] as ApplicationLayerDummy["ci"],
    offset: pos,
  };

  return {
    state: {
      ...state,
      data: fixedData,
      pos: pos + 1,
    },
    applicationLayer: apl,
    linkLayer,
  };
}
