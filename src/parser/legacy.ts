import { DIF_DATATYPE_INT48 } from "@/helper/constants";
import {
  type DataRecord,
  type EvaluatedData,
  EvaluatedDataType,
  type LegacyResult,
  type ParserResultVerbose,
} from "@/types";

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

const functionFieldTypes = {
  0b00: "Instantaneous value",
  0b01: "Maximum value",
  0b10: "Minimum value",
  0b11: "Value during error state",
};

const validStates = {
  0x00: "no errors",
  0x01: "application busy",
  0x02: "any application error",
  0x03: "abnormal condition/alarm",
  0x04: "battery low",
  0x08: "permanent error",
  0x10: "temporary error",
  0x20: "specific to manufacturer",
  0x40: "specific to manufacturer",
  0x80: "specific to manufacturer",
};

const replacementMap = {
  YYYY: (date: Date) => date.getFullYear().toString(),
  MM: (date: Date) => (date.getMonth() + 1).toString().padStart(2, "0"),
  DD: (date: Date) => date.getDate().toString().padStart(2, "0"),
  hh: (date: Date) => date.getHours().toString().padStart(2, "0"),
  mm: (date: Date) => date.getMinutes().toString().padStart(2, "0"),
  ss: (date: Date) => date.getSeconds().toString().padStart(2, "0"),
};

function formatDate(date: Date, format: string) {
  return Object.entries(replacementMap).reduce(
    (formattedDate, [key, mapFn]) => {
      return formattedDate.replace(key, mapFn(date));
    },
    format
  );
}

function dataTypeToLegacyDataType(data: EvaluatedData, dr: DataRecord) {
  switch (data.type) {
    case EvaluatedDataType.Null:
      return "null";
    case EvaluatedDataType.Number:
      return data.value as number;
    case EvaluatedDataType.BigInt:
      return (data.value as bigint).toString();
    case EvaluatedDataType.Buffer:
      return (data.value as Buffer).toString("hex");
    case EvaluatedDataType.Date:
      return formatDate(data.value as Date, "YYYY-MM-DD");
    case EvaluatedDataType.DateTime:
      if (dr.header.dib.dataField === DIF_DATATYPE_INT48) {
        return formatDate(data.value as Date, "YYYY-MM-DD hh:mm:ss");
      } else {
        return formatDate(data.value as Date, "YYYY-MM-DD hh:mm");
      }
    default:
      return data.value.toString();
  }
}

function createLegacyDataRecord(
  num: number,
  data: EvaluatedData,
  dr: DataRecord
): ArrayElement<LegacyResult["dataRecord"]> {
  const val = dataTypeToLegacyDataType(data, dr);

  const functionFieldTypeKey = dr.header.dib
    .functionField as keyof typeof functionFieldTypes;

  return {
    number: num,
    value: val,
    unit: data.unit,
    type: data.info.legacyVif,
    description: data.description,
    tariff: data.info.tariff,
    storageNo: data.info.storageNo,
    devUnit: data.info.deviceUnit,
    functionFieldText:
      functionFieldTypes[functionFieldTypeKey] ?? "Unknown function field type",
    functionField: dr.header.dib.functionField,
  };
}

export function createLegacyResult(result: ParserResultVerbose): LegacyResult {
  const statusCode: keyof typeof validStates =
    result.applicationLayer.ci === 0x7a || result.applicationLayer.ci === 0x72
      ? (result.applicationLayer.statusCode as keyof typeof validStates)
      : 0;

  const deviceInformation: LegacyResult["deviceInformation"] = {
    AccessNumber: result.meter.accessNo ?? 0,
    Id: result.meter.id,
    Manufacturer: result.meter.manufacturer,
    Medium: result.meter.deviceType,
    Status: statusCode,
    StatusString: validStates[statusCode] ?? "",
    Version: result.meter.version,
    Address: result.linkLayer.addressRaw.toString("hex"),
  };

  const dataRecord: LegacyResult["dataRecord"] = [];

  let count = 0;
  for (const data of result.data) {
    count++;
    const legacyDataRecord = createLegacyDataRecord(
      count,
      data,
      result.dataRecords[count - 1]
    );
    dataRecord.push(legacyDataRecord);
  }

  return { deviceInformation, dataRecord: dataRecord };
}
