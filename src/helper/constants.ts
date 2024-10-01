export const DATA_LINK_LAYER_SIZE = 10;

export const FRAME_A_BLOCK_SIZE = 16;
export const FRAME_B_BLOCK_SIZE = 128;

export const AES_BLOCK_SIZE = 16;

export const CI_ELL_2 = 0x8c; // Extended Link Layer, 2 Bytes - OMS
export const CI_ELL_8 = 0x8d; // Extended Link Layer, 8 Bytes
export const CI_ELL_10 = 0x8e; // Extended Link Layer, 10 Bytes - OMS
export const CI_ELL_16 = 0x8f; // Extended Link Layer, 16 Bytes

export const CI_ELL = [CI_ELL_2, CI_ELL_8, CI_ELL_10, CI_ELL_16];
export const CI_AFL = 0x90;

export const CI_RESP_0 = 0x78; // Response from device, 0 Byte header, variable length
export const CI_RESP_4 = 0x7a; // Response from device, 4 Bytes
export const CI_RESP_12 = 0x72; // Response from device, 12 Bytes
export const CI_RESP_SML_4 = 0x7e; // Response from device, 4 Bytes, application layer SML encoded
export const CI_RESP_SML_12 = 0x7f; // Response from device, 12 Bytes, application layer SML encoded
export const CI_RESP_COMPACT = 0x79; // Response from device, no header, Kamstrup(?) compact frame without data record header

export const CI_APL = [CI_RESP_0, CI_RESP_4, CI_RESP_12];

export const DIF_VIF_EXTENSION_BIT = 0x80;
export const DIF_VIF_EXTENSION_MASK = 0x7f;
export const DIF_FILL_BYTE = 0x2f;
export const DIF_DATATYPE_NONE = 0x00;
export const DIF_DATATYPE_INT8 = 0x01;
export const DIF_DATATYPE_INT16 = 0x02;
export const DIF_DATATYPE_INT24 = 0x03;
export const DIF_DATATYPE_INT32 = 0x04;
export const DIF_DATATYPE_FLOAT32 = 0x05;
export const DIF_DATATYPE_INT48 = 0x06;
export const DIF_DATATYPE_INT64 = 0x07;
export const DIF_DATATYPE_READOUT = 0x08;
export const DIF_DATATYPE_BCD2 = 0x09;
export const DIF_DATATYPE_BCD4 = 0x0a;
export const DIF_DATATYPE_BCD6 = 0x0b;
export const DIF_DATATYPE_BCD8 = 0x0c;
export const DIF_DATATYPE_VARLEN = 0x0d;
export const DIF_DATATYPE_BCD12 = 0x0e;
export const DIF_SPECIAL_FUNCTIONS = 0x0f;

export const VALID_DEVICES_TYPES = {
  0x00: "Other",
  0x01: "Oil",
  0x02: "Electricity",
  0x03: "Gas",
  0x04: "Heat",
  0x05: "Steam",
  0x06: "Warm Water (30 °C ... 90 °C)",
  0x07: "Water",
  0x08: "Heat Cost Allocator",
  0x09: "Compressed Air",
  0x0a: "Cooling load meter (Volume measured at return temperature: outlet)",
  0x0b: "Cooling load meter (Volume measured at flow temperature: inlet)",
  0x0c: "Heat (Volume measured at flow temperature: inlet)",
  0x0d: "Heat / Cooling load meter",
  0x0e: "Bus / System component",
  0x0f: "Unknown Medium",
  0x10: "Reserved for utility meter",
  0x11: "Reserved for utility meter",
  0x12: "Reserved for utility meter",
  0x13: "Reserved for utility meter",
  0x14: "Calorific value",
  0x15: "Hot water (> 90 °C)",
  0x16: "Cold water",
  0x17: "Dual register (hot/cold) Water meter",
  0x18: "Pressure",
  0x19: "A/D Converter",
  0x1a: "Smokedetector",
  0x1b: "Room sensor (e.g. temperature or humidity)",
  0x1c: "Gasdetector",
  0x1d: "Reserved for sensors",
  0x1e: "Reserved for sensors",
  0x1f: "Reserved for sensors",
  0x20: "Breaker (electricity)",
  0x21: "Valve (gas)",
  0x22: "Reserved for switching devices",
  0x23: "Reserved for switching devices",
  0x24: "Reserved for switching devices",
  0x25: "Customer unit (Display device)",
  0x26: "Reserved for customer units",
  0x27: "Reserved for customer units",
  0x28: "Waste water",
  0x29: "Garbage",
  0x2a: "Carbon dioxide",
  0x2b: "Environmental meter",
  0x2c: "Environmental meter",
  0x2d: "Environmental meter",
  0x2e: "Environmental meter",
  0x2f: "Environmental meter",
  0x31: "OMS MUC",
  0x32: "OMS unidirectional repeater",
  0x33: "OMS bidirectional repeater",
  0x37: "Radio converter (Meter side)",
  0x43: "Heat meter (TCH)",
  0x62: "Hot water meter (TCH)",
  0x72: "Cold water meter (TCH)",
  0x80: "Heat cost allocator (TCH)",
  0xf0: "Smoke detector (TCH)",
};
