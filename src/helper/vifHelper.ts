import {
  DIF_DATATYPE_INT16,
  DIF_DATATYPE_INT48,
  FIELD_TYPE_ERROR_STATE,
  FIELD_TYPE_INSTANTANEOUS,
  FIELD_TYPE_MAXIMUM,
  FIELD_TYPE_MINIMUM,
} from "@/helper/constants";
import { ParserError } from "@/helper/error";
import {
  decodeDateTimeTypeF,
  decodeDateTimeTypeI,
  decodeDateTypeG,
} from "@/helper/helper";
import {
  type DataRecord,
  type DataType,
  type EvaluatedData,
  EvaluatedDataType,
  type VIFDescriptor,
  type VIFEDescriptor,
} from "@/types";

export function multiply(
  value: DataType | Date,
  multiplicator: number
): number | bigint {
  if (typeof value === "number") {
    return value * multiplicator;
  } else if (typeof value === "bigint") {
    return value * BigInt(multiplicator);
  } else {
    throw new ParserError("UNEXPECTED_STATE", "Wrong data types!");
  }
}

export function add(value: DataType | Date, summand: number): number | bigint {
  if (typeof value === "number") {
    return value + summand;
  } else if (typeof value === "bigint") {
    return value + BigInt(summand);
  } else {
    throw new ParserError("UNEXPECTED_STATE", "Wrong data types!");
  }
}

export function divide(
  value: DataType | Date,
  divisor: number
): number | bigint {
  if (typeof value === "number") {
    return value / divisor;
  } else if (typeof value === "bigint") {
    return Number((value * BigInt(divisor)) / BigInt(divisor)) / divisor;
  } else {
    throw new ParserError("UNEXPECTED_STATE", "Unexpected type!");
  }
}

function dataTypeToString(value: DataType): string {
  if (value === null) {
    return "<null>";
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("hex");
  } else {
    return value.toString();
  }
}

export function applyFunctionFieldType(
  data: EvaluatedData,
  dataRecord: DataRecord
) {
  switch (dataRecord.header.dib.functionField) {
    case FIELD_TYPE_INSTANTANEOUS:
      return data;
    case FIELD_TYPE_MAXIMUM:
      data.description += " (maximum value)";
      return data;
    case FIELD_TYPE_MINIMUM:
      data.description += " (minimum value)";
      return data;
    case FIELD_TYPE_ERROR_STATE:
      data.description += " (during error state)";
      return data;
    default:
      return data;
  }
}

function getInfo(vif: VIFDescriptor, dataRecord: DataRecord) {
  return {
    legacyVif: vif.legacyName,
    tariff: dataRecord.header.dib.tariff,
    deviceUnit: dataRecord.header.dib.deviceUnit,
    storageNo: dataRecord.header.dib.storageNo,
  };
}

export function applyStringifyDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
): EvaluatedData {
  const stringValue = dataTypeToString(dataRecord.value);
  return {
    value: stringValue,
    unit: vif.unit,
    description: vif.description,
    type: EvaluatedDataType.String,
    info: getInfo(vif, dataRecord),
  };
}

export function applyNumberOrStringifyDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
): EvaluatedData {
  if (
    typeof dataRecord.value !== "number" &&
    typeof dataRecord.value !== "bigint"
  ) {
    const stringValue = dataTypeToString(dataRecord.value);
    return {
      value: stringValue,
      unit: vif.unit,
      description: vif.description,
      type: EvaluatedDataType.String,
      info: getInfo(vif, dataRecord),
    };
  }
  const type =
    typeof dataRecord.value === "bigint"
      ? EvaluatedDataType.BigInt
      : EvaluatedDataType.Number;
  return {
    value: dataRecord.value,
    unit: vif.unit,
    description: vif.description,
    type: type,
    info: getInfo(vif, dataRecord),
  };
}

export function applyNumberDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
): EvaluatedData {
  const type =
    typeof dataRecord.value === "bigint"
      ? EvaluatedDataType.BigInt
      : EvaluatedDataType.Number;
  return {
    value: vif.calc(dataRecord.value),
    unit: vif.unit,
    description: vif.description,
    type: type,
    info: getInfo(vif, dataRecord),
  };
}

export function applyDateOrDateTimeDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
): EvaluatedData {
  if (typeof dataRecord.value !== "number") {
    throw new ParserError("UNEXPECTED_STATE", "Unexpected type!");
  }

  if (dataRecord.header.dib.dataField === DIF_DATATYPE_INT16) {
    return applyDateDefault(vif, dataRecord);
  } else {
    return applyDateTimeDefault(vif, dataRecord);
  }
}

export function applyDateDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
): EvaluatedData {
  if (typeof dataRecord.value !== "number") {
    throw new ParserError("UNEXPECTED_STATE", "Unexpected type!");
  }

  const date = decodeDateTypeG(dataRecord.value);
  return {
    value: date,
    unit: "",
    description: vif.description,
    type: EvaluatedDataType.Date,
    info: getInfo(vif, dataRecord),
  };
}

export function applyDateTimeDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
): EvaluatedData {
  if (typeof dataRecord.value !== "number") {
    throw new ParserError("UNEXPECTED_STATE", "Unexpected type!");
  }

  const date =
    dataRecord.header.dib.dataField === DIF_DATATYPE_INT48
      ? decodeDateTimeTypeI(dataRecord.value)
      : decodeDateTimeTypeF(dataRecord.value);
  return {
    value: date,
    unit: "",
    description: vif.description,
    type: EvaluatedDataType.DateTime,
    info: getInfo(vif, dataRecord),
  };
}

export function applyBufferOrNumberDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
): EvaluatedData {
  if (Buffer.isBuffer(dataRecord.value)) {
    return {
      value: dataRecord.value,
      unit: vif.unit,
      description: vif.description,
      type: EvaluatedDataType.Buffer,
      info: getInfo(vif, dataRecord),
    };
  }

  if (
    typeof dataRecord.value !== "number" &&
    typeof dataRecord.value !== "bigint"
  ) {
    throw new ParserError("UNEXPECTED_STATE", "Unexpected type");
  }
  const type =
    typeof dataRecord.value === "bigint"
      ? EvaluatedDataType.BigInt
      : EvaluatedDataType.Number;

  return {
    value: dataRecord.value,
    unit: vif.unit,
    description: vif.description,
    type: type,
    info: getInfo(vif, dataRecord),
  };
}

// VIFE

export function noop(
  _descriptor: VIFEDescriptor,
  _dataRecord: DataRecord,
  evaluatedData: EvaluatedData
) {
  return evaluatedData;
}

export function applyNumberEvaluated(
  descriptor: VIFEDescriptor,
  _dataRecord: DataRecord,
  evaluatedData: EvaluatedData
) {
  if (
    evaluatedData.type !== EvaluatedDataType.BigInt &&
    evaluatedData.type !== EvaluatedDataType.Number
  ) {
    throw new ParserError("UNEXPECTED_STATE", "Unexpected type");
  }

  evaluatedData.value = descriptor.calc(evaluatedData.value);
  return evaluatedData;
}

export function extendDescription(
  descriptor: VIFEDescriptor,
  _dataRecord: DataRecord,
  evaluatedData: EvaluatedData
) {
  if (descriptor.description === undefined) {
    throw new ParserError("UNEXPECTED_STATE", "Description is missing!");
  }
  evaluatedData.description += `; ${descriptor.description}`;
  return evaluatedData;
}

export function extendDescriptionReplaceDateOrTime(
  descriptor: VIFEDescriptor,
  dataRecord: DataRecord,
  evaluatedData: EvaluatedData
) {
  if (descriptor.description === undefined) {
    throw new ParserError("UNEXPECTED_STATE", "Description is missing!");
  }

  const description =
    dataRecord.header.dib.dataField === DIF_DATATYPE_INT16
      ? descriptor.description.replace("date or time", "date")
      : descriptor.description.replace("date or time", "time");

  evaluatedData.description += `; ${description}`;
  return evaluatedData;
}

export function extendUnit(
  descriptor: VIFEDescriptor,
  _dataRecord: DataRecord,
  evaluatedData: EvaluatedData
) {
  if (descriptor.unit === undefined) {
    throw new ParserError("UNEXPECTED_STATE", "Unit is missing!");
  }
  evaluatedData.unit += ` ${descriptor.unit}`;
  return evaluatedData;
}
