import {
  applyNumberDefault,
  applyStringifyDefault,
  extendDescription,
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
};
