import { DIF_DATATYPE_VARLEN } from "@/helper/constants";
import { log } from "@/helper/logger";
import { applyFunctionFieldType } from "@/helper/vifHelper";
import type {
  DataRecord,
  DataType,
  EvaluatedData,
  ManufacturerSpecificBlob,
  ManufacturerSpecificDataRecordHandler,
  ManufacturerSpecificValue,
  MeterData,
} from "@/types";
import { EvaluatedDataType, VifTable } from "@/types";

// A manufacturer specific record carries data the standard does not describe.
// It is either a VIF of the manufacturer table or the plain "manufacturer
// specific" VIF 0x7f of the default table.
export function isManufacturerSpecific(dataRecord: DataRecord) {
  const primary = dataRecord.header.vib.primary;
  return (
    primary.table === VifTable.Manufacturer ||
    (primary.table === VifTable.Default && primary.vif === 0x7f)
  );
}

// The value of a variable length record starts with its LVAR field, which
// states the length and is not part of the data itself.
export function getBlobData(
  data: Buffer,
  dataRecord: DataRecord,
  valueStart: number,
  valueEnd: number
) {
  const start =
    dataRecord.header.dib.dataField === DIF_DATATYPE_VARLEN
      ? valueStart + 1
      : valueStart;
  return Buffer.from(data.subarray(start, valueEnd));
}

function getDataType(value: DataType | Date) {
  if (value === null) {
    return EvaluatedDataType.Null;
  } else if (value instanceof Date) {
    return EvaluatedDataType.DateTime;
  } else if (Buffer.isBuffer(value)) {
    return EvaluatedDataType.Buffer;
  } else if (typeof value === "bigint") {
    return EvaluatedDataType.BigInt;
  } else if (typeof value === "number") {
    return EvaluatedDataType.Number;
  } else {
    return EvaluatedDataType.String;
  }
}

function createEvaluatedData(
  source: DataRecord,
  value: ManufacturerSpecificValue
): EvaluatedData {
  const evaluatedData: EvaluatedData = {
    value: value.value,
    unit: value.unit ?? "",
    description: value.description,
    type: getDataType(value.value),
    info: {
      legacyVif: value.legacyName ?? "VIF_MANUFACTURER_SPECIFIC",
      tariff: value.tariff ?? source.header.dib.tariff,
      deviceUnit: source.header.dib.deviceUnit,
      storageNo: value.storageNo ?? source.header.dib.storageNo,
    },
  };

  // minimum, maximum and error state are properties of the record the value
  // was taken from
  return applyFunctionFieldType(evaluatedData, source);
}

export function evaluateManufacturerSpecificData(
  blobs: ManufacturerSpecificBlob[],
  handler: ManufacturerSpecificDataRecordHandler,
  meterData: MeterData
): EvaluatedData[] {
  const evaluatedData: EvaluatedData[] = [];

  for (const blob of blobs) {
    let values: ManufacturerSpecificValue[];
    try {
      values = handler(blob.data, meterData, blob.dataRecord);
    } catch (error: unknown) {
      // a broken handler must not cost us the rest of the telegram
      log.error(`Decoding manufacturer specific data failed: ${String(error)}`);
      continue;
    }

    for (const value of values) {
      evaluatedData.push(createEvaluatedData(blob.dataRecord, value));
    }
  }

  return evaluatedData;
}
