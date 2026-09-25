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
  return getFallbackExtensionDescriptor(extension, true);
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
    return getFallbackExtensionDescriptor(extension);
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
    name: "plain_text",
    unit: primaryVif.plainText,
    description: "",
    calc: (val) => val,
    apply: applyNumberOrStringifyDefault,
  };
}

// The code is part of the name, so that two unknown VIFs of one telegram stay
// apart. It is decimal, as a hex digit may follow a letter ("fd_a1"), which a
// name does not allow.
function fallbackName(primaryVif: PrimaryVif, manufacturerSpecific: boolean) {
  if (manufacturerSpecific) {
    return `manufacturer_specific_vif_${primaryVif.vif}`;
  }
  switch (primaryVif.table) {
    case VifTable.FD:
      return `unknown_vif_fd_${primaryVif.vif}`;
    case VifTable.FB:
      return `unknown_vif_fb_${primaryVif.vif}`;
    default:
      return `unknown_vif_${primaryVif.vif}`;
  }
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
    name: fallbackName(dataRecord.header.vib.primary, manufacturerSpecific),
    unit: "",
    description: `Unknown ${manufacturerSpecific ? "manufacturer specific " : ""}VIF 0x${dataRecord.header.vib.primary.vif.toString(16).padStart(2, "0")}`,
    calc: (val) => val,
    apply: applyStringifyDefault,
  };
}

function getFallbackExtensionDescriptor(
  extension: number,
  manufacturerSpecific = false
): VIFEDescriptor {
  // the standard reserves the whole range for record errors
  if (!manufacturerSpecific && extension <= 0x1f) {
    return {
      vif: extension,
      legacyName: "VIFE_UNKNOWN",
      error: `unknown_error_${extension}`,
      description: `Unknown record error 0x${extension.toString(16).padStart(2, "0")}`,
      apply: extendDescription,
    };
  }

  return {
    vif: extension,
    legacyName: manufacturerSpecific
      ? "VIFE_MANUFACTURER_UNKNOWN"
      : "VIFE_UNKNOWN",
    // an unknown extension may change what the value means, so it keeps the
    // record apart from one without it
    name: `${manufacturerSpecific ? "manufacturer_specific" : "unknown"}_vife_${extension}`,
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

  let result: EvaluatedData | undefined;
  try {
    result = descriptor.apply(descriptor, dataRecord, data);
  } catch (e: unknown) {
    log.error(`Applying VIFE failed: ${JSON.stringify(e)}`);
  }

  // a descriptor may return a new object instead of modifying the given one,
  // the previous result is kept if applying the VIFE failed - the name belongs
  // to the record either way
  result ??= data;
  if (descriptor.name !== undefined) {
    result.info.extensionNames.push(descriptor.name);
  }
  // the first error is the one to report, a meter hardly states two
  if (descriptor.error !== undefined) {
    result.info.recordError ??= descriptor.error;
  }
  return result;
}

function evaluateDataRecord(
  dataRecord: DataRecord,
  meterType: MeterData
): EvaluatedData {
  let evaluatedData = evaluatePrimaryVif(dataRecord, meterType);
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

    evaluatedData = evaluateVifExtension(
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
