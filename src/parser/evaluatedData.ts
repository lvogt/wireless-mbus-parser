import { ParserError } from "@/helper/error";
import { isPrimaryVifString } from "@/helper/helper";
import { log } from "@/helper/logger";
import {
  applyFunctionFieldType,
  applyNumberOrStringifyDefault,
  applyStringifyDefault,
  extendDescription,
} from "@/helper/vifHelper";
import type {
  DataRecord,
  EvaluatedData,
  MeterData,
  PrimaryVif,
  VIFDescriptor,
  VIFEDescriptor,
} from "@/types";
import { VifTable } from "@/types";
import { defaultVIFs } from "@/vif/defaultVifs";
import { fbVifs } from "@/vif/fbVifs";
import { fdVifs } from "@/vif/fdVifs";
import {
  manufacturerSpecificsVifes,
  manufacturerSpecificsVifs,
} from "@/vif/manufacturerSpecificVifs";
import { vifExtensions } from "@/vif/vifExtension";

function getDescriptor(dataRecord: DataRecord, meterType: MeterData) {
  switch (dataRecord.header.vib.primary.table) {
    case VifTable.Default:
      return defaultVIFs.find(
        (item) => item.vif === dataRecord.header.vib.primary.vif
      );
    case VifTable.FD:
      return fdVifs.find(
        (item) => item.vif === dataRecord.header.vib.primary.vif
      );
    case VifTable.FB:
      return fbVifs.find(
        (item) => item.vif === dataRecord.header.vib.primary.vif
      );
    case VifTable.Plain:
      return getPlainTextDescriptor(dataRecord.header.vib.primary);
    case VifTable.Manufacturer:
      return getManufacturerSpecificsVifDescriptor(dataRecord, meterType);
    default:
      throw new ParserError(
        "UNIMPLEMENTED_FEATURE",
        "Table not yet implemented"
      );
  }
}

function getManufacturerSpecificsVifDescriptor(
  dataRecord: DataRecord,
  meterType: MeterData
) {
  if (meterType.manufacturer in manufacturerSpecificsVifs) {
    const descriptor = manufacturerSpecificsVifs[meterType.manufacturer].find(
      (item) => item.vif === dataRecord.header.vib.primary.vif
    );
    if (descriptor != undefined) {
      return descriptor;
    }
  }
  return getFallbackDescriptor(dataRecord, true);
}

function getManufacturerSpecificsVifeDescriptor(
  extension: number,
  meterType: MeterData
) {
  if (meterType.manufacturer in manufacturerSpecificsVifes) {
    const descriptor = manufacturerSpecificsVifes[meterType.manufacturer].find(
      (item) => item.vif === extension
    );
    if (descriptor != undefined) {
      return descriptor;
    }
  }
  return getFallbackExtensiontDescriptor(extension, true);
}

function getVifeDescriptor(
  extension: number,
  meterType: MeterData,
  manufacturerSpecific = false
) {
  if (manufacturerSpecific) {
    return getManufacturerSpecificsVifeDescriptor(extension, meterType);
  }

  const descriptor = vifExtensions.find((item) => item.vif === extension);
  if (descriptor === undefined) {
    return getFallbackExtensiontDescriptor(extension);
  } else {
    return descriptor;
  }
}

function getPlainTextDescriptor(primaryVif: PrimaryVif): VIFDescriptor {
  if (!isPrimaryVifString(primaryVif)) {
    throw new ParserError("UNEXPECTED_STATE", "PrimaryVifString expected!");
  }

  return {
    vif: primaryVif.vif,
    legacyName: "VIF_PLAIN_TEXT",
    unit: primaryVif.plainText,
    description: "",
    calc: (val) => val,
    apply: applyNumberOrStringifyDefault,
  };
}

function getFallbackDescriptor(
  dataRecord: DataRecord,
  manufacturerSpecific = false
): VIFDescriptor {
  if (dataRecord.header.vib.primary.vif === 0x7f) {
    manufacturerSpecific = true;
  }
  return {
    vif: dataRecord.header.vib.primary.vif,
    legacyName: manufacturerSpecific
      ? "VIF_TYPE_MANUFACTURER_UNKOWN"
      : "VIF_UNKNOWN",
    unit: "",
    description: `Unknown ${manufacturerSpecific ? "manufacturer specific " : ""}VIF 0x${dataRecord.header.vib.primary.vif.toString(16).padStart(2, "0")}`,
    calc: (val) => val,
    apply: applyStringifyDefault,
  };
}

function getFallbackExtensiontDescriptor(
  extension: number,
  manufacturerSpecific = false
): VIFEDescriptor {
  return {
    vif: extension,
    legacyName: manufacturerSpecific
      ? "VIFE_MANUFACTURER_UNKNOWN"
      : "VIFE_UNKNOWN",
    description: `Unknown VIFE 0x${extension.toString(16).padStart(2, "0")}`,
    apply: extendDescription,
  };
}

function evaluatePrimaryVif(dataRecord: DataRecord, meterType: MeterData) {
  let descriptor = getDescriptor(dataRecord, meterType);
  if (descriptor === undefined) {
    descriptor = getFallbackDescriptor(dataRecord);
  }

  try {
    const evaluatedData = descriptor.apply(descriptor, dataRecord);
    return applyFunctionFieldType(evaluatedData, dataRecord);
  } catch {
    return applyStringifyDefault(descriptor, dataRecord);
  }
}

function evaluateVifExtension(
  data: EvaluatedData,
  dataRecord: DataRecord,
  meterType: MeterData,
  extension: number,
  manufacturerSpecific: boolean
) {
  const descriptor = getVifeDescriptor(
    extension,
    meterType,
    manufacturerSpecific
  );

  try {
    return descriptor.apply(descriptor, dataRecord, data);
  } catch (e: unknown) {
    log.debug(`Applying VIFE failed: ${JSON.stringify(e)}`);
  }
}

function evaluateDataRecord(
  dataRecord: DataRecord,
  meterType: MeterData
): EvaluatedData {
  const evaluatedData = evaluatePrimaryVif(dataRecord, meterType);
  const manufacturerSpecificPrimaryVif =
    dataRecord.header.vib.primary.table === VifTable.Manufacturer;

  let lastExtManufacturerSpecific = false;
  for (const ext of dataRecord.header.vib.extensions) {
    if (ext === 0x7f) {
      lastExtManufacturerSpecific = true;
      continue;
    }

    const manufacturerSpecificTable =
      manufacturerSpecificPrimaryVif || lastExtManufacturerSpecific;

    evaluateVifExtension(
      evaluatedData,
      dataRecord,
      meterType,
      ext,
      manufacturerSpecificTable
    );
  }

  return evaluatedData;
}

export function evaluateDataRecords(
  dataRecords: DataRecord[],
  meterType: MeterData
): EvaluatedData[] {
  return dataRecords.map((record) => evaluateDataRecord(record, meterType));
}
