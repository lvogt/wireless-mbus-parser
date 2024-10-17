import { DIF_DATATYPE_INT16, DIF_DATATYPE_INT48 } from "@/helper/constants";
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
    throw new Error("Wrong data types!");
  }
}

export function add(value: DataType | Date, summand: number): number | bigint {
  if (typeof value === "number") {
    return value + summand;
  } else if (typeof value === "bigint") {
    return value + BigInt(summand);
  } else {
    throw new Error("Wrong data types!");
  }
}

export function divide(
  value: DataType | Date,
  divisor: number
): number | bigint {
  if (typeof value === "number") {
    return value / divisor;
  } else if (typeof value === "bigint") {
    return value / BigInt(divisor);
  } else {
    throw new Error("Unexpected type!");
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

export function applyStringifyDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
) {
  const stringValue = dataTypeToString(dataRecord.value);
  return {
    value: stringValue,
    unit: vif.unit,
    description: vif.description,
    type: EvaluatedDataType.String,
  };
}

export function applyNumberOrStringifyDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
) {
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
  };
}

export function applyDateOrDateTimeDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
) {
  if (typeof dataRecord.value !== "number") {
    throw new Error("Unexpected type!");
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
    throw new Error("Unexpected type!");
  }

  const date = decodeDateTypeG(dataRecord.value);
  return {
    value: date,
    unit: "",
    description: vif.description,
    type: EvaluatedDataType.Date,
  };
}

export function applyDateTimeDefault(
  vif: VIFDescriptor,
  dataRecord: DataRecord
): EvaluatedData {
  if (typeof dataRecord.value !== "number") {
    throw new Error("Unexpected type!");
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
    };
  }

  if (
    typeof dataRecord.value !== "number" &&
    typeof dataRecord.value !== "bigint"
  ) {
    throw new Error("Unexpected type");
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
    throw new Error("Unexpected type");
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
    throw new Error("Description is missing!");
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
    throw new Error("Description is missing!");
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
    throw new Error("Unit is missing!");
  }
  evaluatedData.unit += ` ${descriptor.unit}`;
  return evaluatedData;
}
