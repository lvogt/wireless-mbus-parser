import { createManufacturerSpecificHandler } from "@/manufacturerSpecificData/fieldSpec";
import type { ManufacturerSpecificFieldSpec } from "@/types";

const DEVICE_TYPE_SMOKE_DETECTOR = 0x1a;

// The smoke detector reports its configuration and error codes as a 64 bit
// integer with the manufacturer specific VIF, one byte per group of flags.
// Reserved bits are named null and are not reported.
const SMOKE_DETECTOR_STATE: ManufacturerSpecificFieldSpec[] = [
  { byte: 0, bit: 7, description: "Data encrypted" },
  {
    byte: 1,
    flags: [
      "Modem code corrupt",
      "Modem memory corrupt",
      "Modem hardware reset",
      "Modem watchdog reset",
      null,
      null,
      "Modem low battery",
      "Modem removal",
    ],
  },
  {
    byte: 2,
    bytes: 2,
    flags: [
      "General alarm",
      "Detector hardware reset",
      "Detector watchdog reset",
      "Beeper defect",
      "Warning: out of temperature range",
      "Warning: intrusion",
      "Warning: inlet blocking",
      "Warning: smoke alarm",
      "Warning: low battery",
      "Warning: no test in last period",
    ],
  },
  {
    byte: 4,
    description: "Remaining battery lifetime",
    unit: "month",
    // the name of the VIF which states the same thing, so a battery reads the
    // same way whether a meter reports it as a VIF or in a blob
    legacyName: "VIF_BATTERY_REMAINING",
  },
  { byte: 5, description: "Product code" },
  {
    byte: 6,
    flags: [
      "Removal occurred",
      "Product installed",
      null, // the network mode, which is the next field
      null,
      "Intrusion occurred",
      "Inlet blocking occurred",
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
