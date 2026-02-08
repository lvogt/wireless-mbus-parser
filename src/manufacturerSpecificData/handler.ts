import type {
  DataRecord,
  EvaluatedData,
  ManufacturerSpecificDataRecordHandler,
  MeterData,
} from "@/types";

export function getHandler(
  meterData: MeterData
): ManufacturerSpecificDataRecordHandler | null {
  /* manufacturer.type.version */
  const handlers: Record<
    string,
    Record<number, Record<number, ManufacturerSpecificDataRecordHandler>>
  > = {
    ITW: {
      0x01: {
        0x02: evaluateItronSmokeDetector,
      },
    },
  };

  const t =
    handlers[meterData.manufacturer]?.[meterData.type]?.[meterData.version] ??
    null;
  return t;
}

function evaluateItronSmokeDetector(
  dataRecord: DataRecord,
  meterData: MeterData
): EvaluatedData {
  return {} as EvaluatedData;
}
