import { getHandler } from "@/manufacturerSpecificData/handler";
import type { DataRecord, EvaluatedData, MeterData } from "@/types";

function evaluateDataRecord(
  dataRecord: DataRecord,
  meterData: MeterData
): EvaluatedData | null {
  if (dataRecord.header.vib.primary.vif !== 0x7f) {
    return null;
  }

  const handler = getHandler(meterData);
  return handler?.(dataRecord, meterData) ?? null;
}

export function evaluateManufacturerSpecificData(
  dataRecords: DataRecord[],
  meterType: MeterData
): EvaluatedData[] {
  return dataRecords
    .map((dr) => evaluateDataRecord(dr, meterType))
    .filter((item) => item !== null);
}
