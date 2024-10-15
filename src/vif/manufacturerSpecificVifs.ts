import {
  applyBufferOrNumberDefault,
  applyNumberDefault,
  applyStringifyDefault,
  divide,
  extendDescription,
  multiply,
} from "@/helper/vifHelper";
import type { VIFDescriptor, VIFEDescriptor } from "@/types";

export const manufacturerSpecificsVifs: Record<string, VIFDescriptor[]> = {
  DME: [
    {
      vif: 0x17,
      legacyName: "VIF_ERROR_FLAGS",
      unit: "",
      description: "Alarm flags",
      calc: (val) => val,
      apply: applyStringifyDefault,
    },
    {
      vif: 0x2c,
      legacyName: "VIF_TRANSMIT_PERIOD",
      unit: "s",
      description: "Transmit period",
      calc: (val) => val,
      apply: applyNumberDefault,
    },
    {
      vif: 0x6e,
      legacyName: "VIF_BATTERY_REMAINING",
      unit: "month",
      description: "Remaining battery life",
      calc: (val) => val,
      apply: applyNumberDefault,
    },
  ],
  ESY: [
    {
      vif: 0x00,
      legacyName: "VIF_ELECTRIC_POWER_PHASE",
      unit: "W",
      description: "Power",
      calc: (val) => divide(val, 100),
      apply: applyNumberDefault,
    },
    {
      vif: 0x28,
      legacyName: "VIF_ELECTRIC_POWER_PHASE_NO",
      unit: "s",
      description: "Phase angle",
      calc: (val) => val,
      apply: applyNumberDefault,
    },
  ],
  KAM: [
    {
      vif: 0x07,
      legacyName: "VIF_ENERGY_E8",
      unit: "Wh",
      description: "Heating energy E8",
      calc: (val) => multiply(val, 1000),
      apply: applyNumberDefault,
    },
    {
      vif: 0x08,
      legacyName: "VIF_ENERGY_E9",
      unit: "Wh",
      description: "Heating energy E9",
      calc: (val) => multiply(val, 1000),
      apply: applyNumberDefault,
    },
    {
      vif: 0x11,
      legacyName: "VIF_KAMSTRUP_CONFIG",
      unit: "s",
      description: "Config number (0x11)",
      calc: (val) => val,
      apply: applyBufferOrNumberDefault,
    },
    {
      vif: 0x1a,
      legacyName: "VIF_KAMSTRUP_METER_TYPE",
      unit: "s",
      description: "Meter type",
      calc: (val) => val,
      apply: applyBufferOrNumberDefault,
    },
    {
      vif: 0x20,
      legacyName: "VIF_KAMSTRUP_INFO_20",
      unit: "s",
      description: "Info register (0x20)",
      calc: (val) => val,
      apply: applyBufferOrNumberDefault,
    },
    {
      vif: 0x22,
      legacyName: "VIF_KAMSTRUP_INFO_22",
      unit: "s",
      description: "Info register (0x22)",
      calc: (val) => val,
      apply: applyBufferOrNumberDefault,
    },
  ],
};

export const manufacturerSpecificsVifes: Record<string, VIFEDescriptor[]> = {
  DME: [
    {
      vif: 0x3e,
      legacyName: "VIF_PREVIOUS_VALUE",
      description: "Previous value",
      apply: extendDescription,
    },
  ],
  KAM: [
    {
      vif: 0x0f,
      legacyName: "VIF_TEMPERATURE_AVG",
      description: "(average)",
      apply: extendDescription,
    },
  ],
};
