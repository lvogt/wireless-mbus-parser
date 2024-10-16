import { calcCrc } from "@/crc/crcCalc";
import {
  DIF_DATATYPE_BCD2,
  DIF_DATATYPE_BCD4,
  DIF_DATATYPE_BCD6,
  DIF_DATATYPE_BCD8,
  DIF_DATATYPE_BCD12,
  DIF_DATATYPE_FLOAT32,
  DIF_DATATYPE_INT8,
  DIF_DATATYPE_INT16,
  DIF_DATATYPE_INT24,
  DIF_DATATYPE_INT32,
  DIF_DATATYPE_INT48,
  DIF_DATATYPE_INT64,
  DIF_DATATYPE_NONE,
  DIF_DATATYPE_READOUT,
  DIF_DATATYPE_VARLEN,
  DIF_FILL_BYTE,
  DIF_SPECIAL_FUNCTIONS,
  DIF_VIF_EXTENSION_BIT,
  DIF_VIF_EXTENSION_MASK,
} from "@/helper/constants";
import { ParserError } from "@/helper/error";
import { decodeBCD } from "@/helper/helper";
import { log } from "@/helper/logger";
import type {
  DataInformationBlock,
  DataRecord,
  DataRecordHeader,
  ParserState,
  PrimaryVif,
  ValueInformationBlock,
} from "@/types";
import { VifTable } from "@/types";

function decodeDataInformationBlock(
  data: Buffer,
  pos: number
): { newPos: number; dib: DataInformationBlock } {
  const dib: DataInformationBlock = {
    tariff: 0,
    deviceUnit: 0,
    storageNo: 0,
    functionField: 0,
    dataField: 0,
  };

  let dif = data[pos++];
  let difExtNo = 0;

  dib.storageNo = (dif & 0b01000000) >> 6;
  dib.functionField = (dif & 0b00110000) >> 4;
  dib.dataField = dif & 0b00001111;

  while (dif & DIF_VIF_EXTENSION_BIT) {
    if (pos >= data.length) {
      throw new ParserError(
        "UNEXPECTED_STATE",
        "No data but DIF extension bit still set!"
      );
    }
    dif = data[pos++];

    if (difExtNo > 9) {
      throw new ParserError("UNEXPECTED_STATE", "Too many DIF extensions!");
    }

    dib.storageNo |= (dif & 0b00001111) << (difExtNo * 4 + 1);
    dib.tariff |= ((dif & 0b00110000) >> 4) << (difExtNo * 2);
    dib.deviceUnit |= ((dif & 0b01000000) >> 6) << difExtNo;
    difExtNo++;
  }

  return { newPos: pos, dib: dib };
}

function buildPrimaryVif(
  vif: number,
  table: VifTable,
  plainText?: string
): PrimaryVif {
  if (table === VifTable.Plain) {
    return {
      vif: vif & DIF_VIF_EXTENSION_MASK,
      table: VifTable.Plain,
      plainText: plainText,
      extensionBitSet: (vif & DIF_VIF_EXTENSION_BIT) !== 0,
    };
  } else {
    return {
      vif: vif & DIF_VIF_EXTENSION_MASK,
      table: table,
      extensionBitSet: (vif & DIF_VIF_EXTENSION_BIT) !== 0,
    };
  }
}

function getPrimaryVif(
  data: Buffer,
  pos: number
): {
  newPos: number;
  primary: PrimaryVif;
} {
  const firstVif = data[pos++];

  if (firstVif == 0xfb) {
    const vif = data[pos++];
    return {
      newPos: pos,
      primary: buildPrimaryVif(vif, VifTable.FB),
    };
  } else if (firstVif == 0xfd) {
    const vif = data[pos++];
    return {
      newPos: pos,
      primary: buildPrimaryVif(vif, VifTable.FD),
    };
  } else if (firstVif == 0xff) {
    const vif = data[pos++];
    return {
      newPos: pos,
      primary: buildPrimaryVif(vif, VifTable.Manufacturer),
    };
  } else if (firstVif == 0x7c || firstVif == 0xfc) {
    const length = data[pos++];
    if (length + pos >= data.length) {
      throw new ParserError(
        "UNEXPECTED_STATE",
        "Not enough bytes left for plain text VIF!"
      );
    }
    const plainTextVif = data
      .toString("ascii", pos, pos + length)
      .split("")
      .reverse()
      .join("");
    pos += length;
    return {
      newPos: pos,
      primary: buildPrimaryVif(firstVif, VifTable.Plain, plainTextVif),
    };
  } else {
    return {
      newPos: pos,
      primary: buildPrimaryVif(firstVif, VifTable.Default),
    };
  }
}

function decodeValueInformationBlock(
  data: Buffer,
  pos: number
): {
  newPos: number;
  vib: ValueInformationBlock;
} {
  const result = getPrimaryVif(data, pos);
  let newPos = result.newPos;
  let extensionFollows = result.primary.extensionBitSet;

  const vib: ValueInformationBlock = {
    primary: result.primary,
    extensions: [],
  };

  while (extensionFollows) {
    if (vib.extensions.length > 11) {
      throw new ParserError("UNEXPECTED_STATE", "Too many VIF extensions!");
    }

    if (newPos + 1 >= data.length) {
      throw new ParserError(
        "UNEXPECTED_STATE",
        "No data left but VIF extension bit still set!"
      );
    }

    const vife = data[newPos++];
    vib.extensions.push(vife & DIF_VIF_EXTENSION_MASK);
    extensionFollows = (vife & DIF_VIF_EXTENSION_BIT) !== 0;
  }

  return {
    newPos: newPos,
    vib: vib,
  };
}

function getDataRecordHeader(
  data: Buffer,
  pos: number
): { newPos: number; dataRecordHeader: DataRecordHeader } {
  const offset = pos;
  const { dib, newPos } = decodeDataInformationBlock(data, pos);

  if (dib.dataField === DIF_SPECIAL_FUNCTIONS) {
    if (newPos < data.length) {
      throw new ParserError(
        "UNEXPECTED_STATE",
        `DIF for special function at ${newPos} - remaining data: ${data.toString("hex", newPos)}`
      );
    }
  }

  const { vib, newPos: newPosAfterVib } = decodeValueInformationBlock(
    data,
    newPos
  );

  return {
    newPos: newPosAfterVib,
    dataRecordHeader: {
      dib: dib,
      vib: vib,
      offset: offset,
      length: newPosAfterVib - offset,
    },
  };
}

function decodeDataRecordValue(
  data: Buffer,
  pos: number,
  header: DataRecordHeader
): {
  value: DataRecord["value"];
  newPos: number;
} {
  switch (header.dib.dataField) {
    case DIF_DATATYPE_NONE:
      log.debug("DIF_NONE found!");
      return { newPos: pos + 1, value: null };
    case DIF_DATATYPE_READOUT:
      log.debug("DIF_READOUT found!");
      return { newPos: pos + 1, value: null };
    case DIF_DATATYPE_BCD2:
      return { newPos: pos + 1, value: decodeBCD(2, data, pos) };
    case DIF_DATATYPE_BCD4:
      return { newPos: pos + 2, value: decodeBCD(4, data, pos) };
    case DIF_DATATYPE_BCD6:
      return { newPos: pos + 3, value: decodeBCD(6, data, pos) };
    case DIF_DATATYPE_BCD8:
      return { newPos: pos + 4, value: decodeBCD(8, data, pos) };
    case DIF_DATATYPE_BCD12:
      return { newPos: pos + 6, value: decodeBCD(12, data, pos) };
    case DIF_DATATYPE_INT8:
      return { newPos: pos + 1, value: data.readInt8(pos) };
    case DIF_DATATYPE_INT16:
      return { newPos: pos + 2, value: data.readUInt16LE(pos) };
    case DIF_DATATYPE_INT24:
      return { newPos: pos + 3, value: data.readUIntLE(pos, 3) };
    case DIF_DATATYPE_INT32:
      return { newPos: pos + 4, value: data.readUInt32LE(pos) };
    case DIF_DATATYPE_INT48:
      return { newPos: pos + 6, value: data.readUIntLE(pos, 6) };
    case DIF_DATATYPE_INT64:
      return { newPos: pos + 8, value: data.readBigUInt64LE(pos) };
    case DIF_DATATYPE_FLOAT32:
      return { newPos: pos + 4, value: data.readFloatLE(pos) };
    case DIF_DATATYPE_VARLEN:
      return decodeLvarValue(data, pos);
    default:
      throw new ParserError(
        "UNIMPLEMENTED_FEATURE",
        `Unknown DataInformationBlock.dataField type: 0x${header.dib.dataField.toString(16)}`
      );
  }
}

function decodeLvarValue(
  data: Buffer,
  pos: number
): {
  value: DataRecord["value"];
  newPos: number;
} {
  const lvar = data[pos++];

  if (lvar <= 0xbf) {
    // ASCII string with lvar characters
    const stringValue = data
      .toString("ascii", pos, pos + lvar)
      .split("")
      .reverse()
      .join("");
    return { newPos: (pos += lvar), value: stringValue };
  } else if (lvar <= 0xcf) {
    // positive BCD number with (lvar - 0xC0) * 2 digits
    const bytes = lvar - 0xc0;
    return { newPos: pos + bytes, value: decodeBCD(bytes * 2, data, pos) };
  } else if (lvar <= 0xdf) {
    // negative BCD number with (lvar - 0xD0) * 2 digits
    const bytes = lvar - 0xd0;
    return { newPos: pos + bytes, value: -1 * decodeBCD(bytes * 2, data, pos) };
  } else if (lvar <= 0xef) {
    // binary number (lvar - E0h) bytes
    const count = lvar - 0xe0;
    if (count <= 6) {
      return { newPos: pos + count, value: data.readIntLE(pos, count) };
    } else {
      const hexString = data.toString("hex", pos, pos + count);
      return { newPos: pos + count, value: hexString };
    }
  } else if (lvar === 0xf8) {
    return { newPos: pos + 8, value: data.readDoubleLE(pos) };
  } else {
    throw new ParserError(
      "UNIMPLEMENTED_FEATURE",
      `Unhandled LVAR field 0x${lvar.toString(16)}`
    );
  }
}

function decodeDataRecord(
  data: Buffer,
  pos: number
): { newPos: number; dr: DataRecord } {
  const { newPos, dataRecordHeader } = getDataRecordHeader(data, pos);
  const { newPos: newPosAfterValue, value } = decodeDataRecordValue(
    data,
    newPos,
    dataRecordHeader
  );
  return {
    newPos: newPosAfterValue,
    dr: {
      header: dataRecordHeader,
      value: value,
    },
  };
}

function decodeDataRecordsFromCache(
  state: ParserState,
  cachedHeaders: DataRecordHeader[]
): {
  state: ParserState;
  dataRecords: DataRecord[];
} {
  const dataRecords: DataRecord[] = [];

  let pos = state.pos;
  const data = state.data;
  for (const header of cachedHeaders) {
    const { newPos, value } = decodeDataRecordValue(data, pos, header);
    pos = newPos;
    dataRecords.push({ header, value });
  }

  return {
    state: {
      pos: pos,
      data: data,
    },
    dataRecords: dataRecords,
  };
}

export function calcHeaderCrc(dataRecords: DataRecord[], data: Buffer) {
  let crcBuffer = Buffer.alloc(0);
  for (const record of dataRecords) {
    const offset = record.header.offset;
    crcBuffer = Buffer.concat([
      crcBuffer,
      data.subarray(offset, offset + record.header.length),
    ]);
  }

  return calcCrc(crcBuffer, 0, crcBuffer.length);
}

export function extractDataRecordHeaders(dataRecords: DataRecord[]) {
  return dataRecords.map((record) => {
    const header = record.header;
    return {
      dib: {
        ...header.dib,
      },
      vib: {
        primary: { ...header.vib.primary },
        extensions: [...header.vib.extensions],
      },
      offset: header.offset,
      length: header.length,
    } as DataRecordHeader;
  });
}

export function decodeDataRecords(
  state: ParserState,
  cachedHeaders?: DataRecordHeader[]
): {
  state: ParserState;
  dataRecords: DataRecord[];
} {
  if (cachedHeaders !== undefined) {
    return decodeDataRecordsFromCache(state, cachedHeaders);
  }

  const data = state.data;
  let pos = state.pos;

  const dataRecords: DataRecord[] = [];

  outerloop: while (pos < data.length) {
    while (data[pos] === DIF_FILL_BYTE) {
      pos++;
      if (pos >= data.length) {
        break outerloop;
      }
    }

    const { newPos, dr } = decodeDataRecord(data, pos);
    pos = newPos;
    dataRecords.push(dr);
  }

  return {
    state: {
      pos: pos,
      data: data,
    },
    dataRecords: dataRecords,
  };
}
