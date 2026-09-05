import type { ManufacturerSpecificValue, MeterData } from "@/types";

const DEVICE_TYPE_SMOKE_DETECTOR = 0x1a;

// The smoke detector reports its configuration and error codes as a 64 bit
// integer with the manufacturer specific VIF, one byte per group of flags.
const SMOKE_DETECTOR_STATE_SIZE = 8;

// Bit names of the flag bytes, the reserved bits have none and are skipped.
const MODEM_ERRORS = [
  "Code corrupt",
  "Memory corrupt",
  "Hardware reset",
  "Watchdog reset",
  null,
  null,
  "Low battery",
  "Removal",
];

const SMOKE_DETECTOR_ERRORS = [
  "General alarm",
  "Hardware reset of the smoke detector",
  "Watchdog reset of the smoke detector",
  "Beeper defect",
  "Warning: out of temperature range",
  "Warning: perimeter intrusion",
  "Warning: smoke inlet blocking",
  "Warning: smoke alarm",
  "Warning: low battery measurement",
  "Warning: no test done during the last period",
];

const SMOKE_DETECTOR_STATUS = [
  "Removal occurred",
  "Product installed",
  null, // network mode, see below
  null,
  "Perimeter intrusion occurred",
  "Smoke inlet blocking occurred",
  "Out of temperature range occurred",
];

const NETWORK_MODES = ["Stand alone", "Walk-by", "Fixed network"];

function decodeFlags(value: number, names: (string | null)[]) {
  return names.flatMap((description, bit) =>
    description === null ? [] : [{ description, value: (value >> bit) & 0b1 }]
  );
}

function decodeSmokeDetectorState(data: Buffer): ManufacturerSpecificValue[] {
  if (data.length < SMOKE_DETECTOR_STATE_SIZE) {
    return [];
  }

  return [
    { description: "Transmitted data encrypted", value: (data[0] >> 7) & 0b1 },
    ...decodeFlags(data[1], MODEM_ERRORS),
    ...decodeFlags(data.readUInt16LE(2), SMOKE_DETECTOR_ERRORS),
    {
      description: "Remaining battery lifetime",
      value: data[4],
      unit: "month",
    },
    { description: "Product code", value: data[5] },
    ...decodeFlags(data[6], SMOKE_DETECTOR_STATUS),
    {
      description: "Network mode",
      value: NETWORK_MODES[(data[6] >> 2) & 0b11] ?? "unknown",
    },
    { description: "Fixed date billing", value: data[7] },
  ];
}

export function decodeItronData(
  data: Buffer,
  meterData: MeterData
): ManufacturerSpecificValue[] {
  if (meterData.type === DEVICE_TYPE_SMOKE_DETECTOR) {
    return decodeSmokeDetectorState(data);
  }

  return [];
}
