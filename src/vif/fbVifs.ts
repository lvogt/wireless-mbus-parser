import { applyNumberDefault, divide } from "@/helper/vifHelper";
import type { VIFDescriptor } from "@/types";
import { decadeRange } from "@/vif/vifRange";

// Cross checked against libmbus on 2026-09-05: all 46 comparable entries
// agreed on unit and scaling exponent. FHEM only implements a single entry of
// this table, so it is no reference for it.
export const fbVifs: VIFDescriptor[] = [
  ...decadeRange(0x00, 2, -1, "VIF_ENERGY_MWH", "energy", "MWh", "Energy"),
  ...decadeRange(0x08, 2, -1, "VIF_ENERGY_GJ", "energy", "GJ", "Energy"),
  ...decadeRange(0x10, 2, 2, "VIF_VOLUME_CM", "volume", "m³", "Volume"),
  ...decadeRange(0x18, 2, 2, "VIF_MASS_T", "mass", "t", "Mass"),
  {
    vif: 0x21,
    legacyName: "VIF_VOLUME_CFEET",
    name: "volume",
    unit: "ft³",
    description: "Volume",
    calc: (val) => divide(val, 10),
    apply: applyNumberDefault,
  },
  {
    vif: 0x22,
    legacyName: "VIF_VOLUME_GALLON",
    name: "volume",
    unit: "gal",
    description: "Volume",
    calc: (val) => divide(val, 10),
    apply: applyNumberDefault,
  },
  {
    vif: 0x23,
    legacyName: "VIF_VOLUME_GALLON_L",
    name: "volume",
    unit: "gal",
    description: "Volume",
    calc: (val) => val,
    apply: applyNumberDefault,
  },
  {
    vif: 0x24,
    legacyName: "VIF_VOLUME_FLOW_GALLON_L",
    name: "volume_flow",
    unit: "gal/min",
    description: "Volume flow",
    calc: (val) => divide(val, 1000),
    apply: applyNumberDefault,
  },
  {
    vif: 0x25,
    legacyName: "VIF_VOLUME_FLOW_GALLON",
    name: "volume_flow",
    unit: "gal/min",
    description: "Volume flow",
    calc: (val) => val,
    apply: applyNumberDefault,
  },
  {
    vif: 0x26,
    legacyName: "VIF_VOLUME_FLOW_GALLON_H",
    name: "volume_flow",
    unit: "gal/h",
    description: "Volume flow",
    calc: (val) => val,
    apply: applyNumberDefault,
  },
  ...decadeRange(0x28, 2, -1, "VIF_POWER_MW", "power", "MW", "Power"),
  ...decadeRange(0x30, 2, -1, "VIF_POWER_GJH", "power", "GJ/h", "Power"),
  ...decadeRange(
    0x58,
    4,
    -3,
    "VIF_TEMPERATURE_FLOW_F",
    "flow_temperature",
    "°F",
    "Flow Temperature"
  ),
  ...decadeRange(
    0x5c,
    4,
    -3,
    "VIF_TEMPERATURE_RETURN_F",
    "return_temperature",
    "°F",
    "Return Temperature"
  ),
  ...decadeRange(
    0x60,
    4,
    -3,
    "VIF_TEMPERATURE_DIFF_F",
    "temperature_difference",
    "°F",
    "Temperature Difference"
  ),
  ...decadeRange(
    0x64,
    4,
    -3,
    "VIF_TEMPERATURE_EXT_F",
    "external_temperature",
    "°F",
    "External Temperature"
  ),
  ...decadeRange(
    0x70,
    4,
    -3,
    "VIF_COLD_WARM_LIMIT_F",
    "cold_warm_temperature_limit",
    "°F",
    "Cold / Warm Temperature Limit"
  ),
  ...decadeRange(
    0x74,
    4,
    -3,
    "VIF_COLD_WARM_LIMIT_C",
    "cold_warm_temperature_limit",
    "°C",
    "Cold / Warm Temperature Limit"
  ),
  ...decadeRange(
    0x78,
    8,
    -3,
    "VIF_CUMUL_COUNT_MAX_POWER",
    "cumul_count_max_power",
    "W",
    "cumul. count max power"
  ),
];
