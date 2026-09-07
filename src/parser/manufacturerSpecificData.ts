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

// The legacy result carries this name as the "type" of a value, where it ends
// up as part of an object id - the ioBroker adapter builds one from it. So
// every value needs a name of its own instead of all of them being
// "manufacturer specific": the description is turned into one, e.g. "Warning:
// smoke alarm" becomes VIF_WARNING_SMOKE_ALARM. Accents are folded, so that a
// description in a language which has them stays readable.
export function toLegacyName(description: string) {
  const name = description
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return name === "" ? "VIF_MANUFACTURER_SPECIFIC" : `VIF_${name}`;
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
      legacyVif: value.legacyName ?? toLegacyName(value.description),
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
