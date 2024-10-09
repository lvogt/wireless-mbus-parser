import { isPrimaryVifString } from "@/helper/helper";
import { log } from "@/helper/logger";
import {
  applyNumberOrStringifyDefault,
  applyStringifyDefault,
  extendDescription,
} from "@/helper/vifHelper";
import type {
  DataRecord,
  EvaluatedData,
  PrimaryVif,
  VIFDescriptor,
  VIFEDescriptor,
} from "@/types";
import { VifTable } from "@/types";
import { defaultVIFs } from "@/vif/defaultVifs";
import { fbVifs } from "@/vif/fbVifs";
import { fdVifs } from "@/vif/fdVifs";
import { vifExtensions } from "@/vif/vifExtension";

function getDescriptor(dataRecord: DataRecord) {
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
      return getFallbackDescriptor(dataRecord, true);
    default:
      throw new Error("Table not yet implemented");
  }
}

function getVifeDescriptor(extension: number) {
  const descriptor = vifExtensions.find((item) => item.vif === extension);
  if (descriptor === undefined) {
    return getFallbackExtensiontDescriptor(extension);
  } else {
    return descriptor;
  }
}

function getPlainTextDescriptor(primaryVif: PrimaryVif): VIFDescriptor {
  if (!isPrimaryVifString(primaryVif)) {
    throw new Error("PrimaryVifString expected!");
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
  return {
    vif: dataRecord.header.vib.primary.vif,
    legacyName: "VIF_UNKNOWN",
    unit: "",
    description: `Unknown ${manufacturerSpecific ? "manufacturer specific " : ""}VIF 0x${dataRecord.header.vib.primary.vif.toString(16)}`,
    calc: (val) => val,
    apply: applyStringifyDefault,
  };
}

function getFallbackExtensiontDescriptor(extension: number): VIFEDescriptor {
  return {
    vif: extension,
    legacyName: "VIFE_UNKNOWN",
    description: `Unknown VIFE 0x${extension.toString(16)}`,
    apply: extendDescription,
  };
}

function evaluatePrimaryVif(dataRecord: DataRecord) {
  let descriptor = getDescriptor(dataRecord);
  if (descriptor === undefined) {
    descriptor = getFallbackDescriptor(dataRecord);
  }

  try {
    return descriptor.apply(descriptor, dataRecord);
  } catch {
    return applyStringifyDefault(descriptor, dataRecord);
  }
}

function evaluateVifExtension(
  data: EvaluatedData,
  dataRecord: DataRecord,
  extension: number
) {
  const descriptor = getVifeDescriptor(extension);

  try {
    return descriptor.apply(descriptor, dataRecord, data);
  } catch (e: unknown) {
    log.debug(`Applying VIFE failed: ${JSON.stringify(e)}`);
  }
}

function evaluateDataRecord(dataRecord: DataRecord): EvaluatedData {
  const evaluatedData = evaluatePrimaryVif(dataRecord);

  for (const ext of dataRecord.header.vib.extensions) {
    evaluateVifExtension(evaluatedData, dataRecord, ext);
  }

  return evaluatedData;
}

export function evaluateDataRecords(
  dataRecords: DataRecord[]
): EvaluatedData[] {
  return dataRecords.map((record) => evaluateDataRecord(record));
}
