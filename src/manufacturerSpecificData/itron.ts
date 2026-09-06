import { createManufacturerSpecificHandler } from "@/manufacturerSpecificData/fieldSpec";
import type { ManufacturerSpecificFieldSpec } from "@/types";

const DEVICE_TYPE_SMOKE_DETECTOR = 0x1a;

// The smoke detector reports its configuration and error codes as a 64 bit
// integer with the manufacturer specific VIF, one byte per group of flags.
// Reserved bits are named null and are not reported.
const SMOKE_DETECTOR_STATE: ManufacturerSpecificFieldSpec[] = [
  { byte: 0, bit: 7, description: "Transmitted data encrypted" },
  {
    byte: 1,
    flags: [
      "Code corrupt",
      "Memory corrupt",
      "Hardware reset",
      "Watchdog reset",
      null,
      null,
      "Low battery",
      "Removal",
    ],
  },
  {
    byte: 2,
    bytes: 2,
    flags: [
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
    ],
  },
  { byte: 4, description: "Remaining battery lifetime", unit: "month" },
  { byte: 5, description: "Product code" },
  {
    byte: 6,
    flags: [
      "Removal occurred",
      "Product installed",
      null, // the network mode, which is the next field
      null,
      "Perimeter intrusion occurred",
      "Smoke inlet blocking occurred",
      "Out of temperature range occurred",
    ],
  },
  {
    byte: 6,
    bits: [2, 3],
    description: "Network mode",
    values: ["Stand alone", "Walk-by", "Fixed network", "unknown"],
  },
  { byte: 7, description: "Fixed date billing" },
];

export const decodeItronData = createManufacturerSpecificHandler([
  { deviceType: DEVICE_TYPE_SMOKE_DETECTOR, fields: SMOKE_DETECTOR_STATE },
]);
