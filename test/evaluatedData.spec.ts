import { describe, expect, it } from "vitest";

import { decodeDataRecords } from "@/parser/dataRecords";
import { evaluateDataRecords } from "@/parser/evaluatedData";
import { EvaluatedDataType, type MeterData } from "@/types";
import { defaultVIFs } from "@/vif/defaultVifs";
import { fbVifs } from "@/vif/fbVifs";
import { fdVifs } from "@/vif/fdVifs";
import {
  manufacturerSpecificsVifes,
  manufacturerSpecificsVifs,
} from "@/vif/manufacturerSpecificVifs";
import { vifExtensions } from "@/vif/vifExtension";

const dummyMeter: MeterData = {
  manufacturer: "ABC",
  version: 0x12,
  type: 0x42,
  id: "12345678",
  deviceType: "Device",
};

function decode(data: string, meterType?: MeterData) {
  const result = decodeDataRecords({ data: Buffer.from(data, "hex"), pos: 0 });
  return evaluateDataRecords(result.dataRecords, meterType ?? dummyMeter);
}

function info(
  legacyVif: string,
  name: string,
  extra?: {
    storageNo?: number;
    deviceUnit?: number;
    tariff?: number;
    functionField?: number;
    extensionNames?: string[];
  }
) {
  return {
    legacyVif,
    name,
    extensionNames: extra?.extensionNames ?? [],
    storageNo: extra?.storageNo ?? 0,
    deviceUnit: extra?.deviceUnit ?? 0,
    tariff: extra?.tariff ?? 0,
    functionField: extra?.functionField ?? 0,
  };
}

interface MinimalVif {
  vif: number;
}

function assertAllVifsAreUnique<T extends MinimalVif>(arr: T[]) {
  for (const element of arr) {
    if (arr.filter((el) => el.vif === element.vif).length > 1) {
      throw new Error(`Duplicate entry for VIF 0x${element.vif.toString(16)}`);
    }
  }
}

describe("VIF data consistency", () => {
  it("No duplicate entries", () => {
    assertAllVifsAreUnique(defaultVIFs);
    assertAllVifsAreUnique(fbVifs);
    assertAllVifsAreUnique(fdVifs);
    assertAllVifsAreUnique(vifExtensions);
    for (const mfVifs of Object.values(manufacturerSpecificsVifs)) {
      assertAllVifsAreUnique(mfVifs);
    }
    for (const mfVifes of Object.values(manufacturerSpecificsVifes)) {
      assertAllVifsAreUnique(mfVifes);
    }
  });
});

describe("Evaluate data records", () => {
  it("INT8/16/24/32/48/64", () => {
    const result = decode(
      "01fb1b360266d9000313153100046d32371f1506131531123456002f2f8780C04084001A0C000000000000"
    );

    expect(result).toHaveLength(6);
    expect(result).toEqual([
      {
        description: "Unknown VIF 0x1b",
        type: EvaluatedDataType.String,
        unit: "",
        value: "54",
        info: info("VIF_UNKNOWN", "unknown_vif_fb_27"),
      },
      {
        description: "External Temperature",
        type: EvaluatedDataType.Number,
        unit: "°C",
        value: 21.7,
        info: info("VIF_EXTERNAL_TEMP", "external_temperature"),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 12.565,
        info: info("VIF_VOLUME", "volume"),
      },
      {
        description: "Time point",
        type: EvaluatedDataType.DateTime,
        unit: "",
        value: new Date("2008-05-31T23:50:00.000Z"),
        info: info("VIF_TIME_POINT_DATE_TIME", "time_point"),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 370240794.901,
        info: info("VIF_VOLUME", "volume"),
      },
      {
        description: "Energy",
        type: EvaluatedDataType.BigInt,
        unit: "Wh",
        value: 30980n,
        info: info("VIF_ENERGY_WATT", "energy", { deviceUnit: 6 }),
      },
    ]);
  });

  it("BCD2/4/6/8/12", () => {
    const result = decode(
      "091345DA023B13012f2f8B60043718020c14270485020e823c513000000000"
    );

    expect(result).toHaveLength(5);
    expect(result).toEqual([
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 0.045,
        info: info("VIF_VOLUME", "volume"),
      },
      {
        description: "Volume Flow (maximum value)",
        type: EvaluatedDataType.Number,
        unit: "m³/h",
        value: 0.113,
        info: info("VIF_VOLUME_FLOW", "volume_flow", {
          storageNo: 5,
          functionField: 1,
        }),
      },
      {
        description: "Energy",
        type: EvaluatedDataType.Number,
        unit: "Wh",
        value: 218370,
        info: info("VIF_ENERGY_WATT", "energy", { deviceUnit: 1, tariff: 2 }),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 28504.27,
        info: info("VIF_VOLUME", "volume"),
      },
      {
        description:
          "Energy; Accumulation of abs value only if negative contributions",
        type: EvaluatedDataType.Number,
        unit: "Wh",
        value: 305.1,
        info: info("VIF_ENERGY_WATT", "energy", {
          extensionNames: ["negative"],
        }),
      },
    ]);
  });

  it("Single value - Manufacturer specific - INT16", () => {
    const result = decode("02ff200001");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Unknown manufacturer specific VIF 0x20",
        type: EvaluatedDataType.String,
        unit: "",
        value: "256",
        info: info(
          "VIF_TYPE_MANUFACTURER_UNKOWN",
          "manufacturer_specific_vif_32"
        ),
      },
    ]);
  });

  it("A record error keeps the name and is reported as such", () => {
    const result = decode("0c931800000000" + "0c930800000000" + "0c1312000000");

    expect(result).toEqual([
      {
        description: "Volume; Data error",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 0,
        info: { ...info("VIF_VOLUME", "volume"), recordError: "data_error" },
      },
      {
        description: "Volume; Unknown record error 0x08",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 0,
        info: {
          ...info("VIF_VOLUME", "volume"),
          recordError: "unknown_error_8",
        },
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 0.012,
        info: info("VIF_VOLUME", "volume"),
      },
    ]);
    expect(result[2].info).not.toHaveProperty("recordError");
  });

  it("Unknown VIFs are named after their code and table", () => {
    const result = decode("016f01" + "01fd1901" + "01fb1b01" + "017f01");

    expect(result.map((entry) => entry.info.name)).toEqual([
      "unknown_vif_111",
      "unknown_vif_fd_25",
      "unknown_vif_fb_27",
      "manufacturer_specific_vif_127",
    ]);
  });

  it("Single value - Error Flag - INT16", () => {
    const result = decode("02fd170000");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Error flags (binary)",
        type: EvaluatedDataType.Number,
        unit: "",
        value: 0,
        info: info("VIF_ERROR_FLAGS", "error_flags"),
      },
    ]);
  });

  it("Single value - Date Type G - INT16", () => {
    const result = decode("426cfe04");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2007-04-30T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point", { storageNo: 1 }),
      },
    ]);
  });

  it("Single value - PlainText - FLOAT32", () => {
    const result = decode("057c096369746568746e79536cb22942");

    expect(result).toHaveLength(1);
    const val = result[0].value;
    result[0].value = null;

    expect(val).toBeCloseTo(42.4242);
    expect(result).toEqual([
      {
        description: "",
        type: EvaluatedDataType.Number,
        unit: "Synthetic",
        value: null,
        info: info("VIF_PLAIN_TEXT", "plain_text"),
      },
    ]);
  });
});

describe("Raw Data Records - LVAR", () => {
  it("Single value - Version - String", () => {
    const result = decode("0dfd0c0434474b42");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Model / Version",
        type: EvaluatedDataType.String,
        unit: "",
        value: "BKG4",
        info: info("VIF_MODEL_VERSION", "model_version"),
      },
    ]);
  });

  it("Single value - Volume - BCD", () => {
    const result = decode("3d13c512345678902f");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Volume (during error state)",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 9078563.412,
        info: info("VIF_VOLUME", "volume", { functionField: 3 }),
      },
    ]);
  });

  it("Single value - Energy - negative BCD", () => {
    const result = decode("2d13d51234567890");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Volume (minimum value)",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: -9078563.412,
        info: info("VIF_VOLUME", "volume", { functionField: 2 }),
      },
    ]);
  });

  it("Single value - Time offset - Binary number", () => {
    const result = decode("cd016de20330");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Time point",
        type: EvaluatedDataType.DateTime,
        unit: "",
        value: new Date("1999-11-30T16:03:00.000Z"),
        info: info("VIF_TIME_POINT_DATE_TIME", "time_point", { storageNo: 3 }),
      },
    ]);
  });

  it("Single value - Time offset - Binary number (large)", () => {
    const result = decode("cd016de803301234567890");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Time point",
        type: EvaluatedDataType.String,
        unit: "",
        value: "03301234567890",
        info: info("VIF_TIME_POINT_DATE_TIME", "time_point", { storageNo: 3 }),
      },
    ]);
  });

  it("Single value - Volume - Double", () => {
    const result = decode("0d13f879cbd58f4d364540");

    expect(result).toHaveLength(1);
    const val = result[0].value;
    result[0].value = null;

    expect(val).toBeCloseTo(0.042424242);
    expect(result).toEqual([
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: null,
        info: info("VIF_VOLUME", "volume"),
      },
    ]);
  });

  it("Single value - Energy - with VIFE", () => {
    const result = decode("0284b9aef77b1234");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Energy; start date of",
        type: EvaluatedDataType.Number,
        unit: "Wh / kg",
        value: 1333001,
        info: info("VIF_ENERGY_WATT", "energy", {
          extensionNames: ["start", "per_kilogram"],
        }),
      },
    ]);
  });

  it("Single value - Temperature - with manufacturer specific VIFE", () => {
    const result = decode("01E7FF8F2003", {
      ...dummyMeter,
      manufacturer: "KAM",
    });

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "External Temperature; (average); Unknown VIFE 0x20",
        type: EvaluatedDataType.Number,
        unit: "°C",
        value: 3,
        info: info("VIF_EXTERNAL_TEMP", "external_temperature", {
          extensionNames: ["average", "manufacturer_specific_vife_32"],
        }),
      },
    ]);
  });

  it("Three values - Date or time - date / time / time I", () => {
    const result = decode("02fd30811104fd3032371f1506fd30563412563412");

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      {
        description: "Start of tariff",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2012-01-01T00:00:00.000Z"),
        info: info("VIF_TARIFF_START", "start_of_tariff"),
      },
      {
        description: "Start of tariff",
        type: EvaluatedDataType.DateTime,
        unit: "",
        value: new Date("2008-05-31T23:50:00.000Z"),
        info: info("VIF_TARIFF_START", "start_of_tariff"),
      },
      {
        description: "Start of tariff",
        type: EvaluatedDataType.DateTime,
        unit: "",
        value: new Date("2026-04-22T18:52:22.000Z"),
        info: info("VIF_TARIFF_START", "start_of_tariff"),
      },
    ]);
  });
});

describe("PRIOS", () => {
  it("Water meter", () => {
    const result = decode(
      "0413eeae020044135da00200426cc12402ff6e9c0003ff2c0800000dff1709736d72616c61206f6e0dff973e09736d72616c61206f6e",
      { ...dummyMeter, manufacturer: "DME" }
    );
    expect(result).toHaveLength(7);
    expect(result).toEqual([
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 175.854,
        info: info("VIF_VOLUME", "volume"),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 172.125,
        info: info("VIF_VOLUME", "volume", { storageNo: 1 }),
      },
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2022-04-01T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point", { storageNo: 1 }),
      },
      {
        description: "Remaining battery life",
        type: EvaluatedDataType.Number,
        unit: "month",
        value: 156,
        info: info("VIF_BATTERY_REMAINING", "remaining_battery_life"),
      },
      {
        description: "Transmit period",
        type: EvaluatedDataType.Number,
        unit: "s",
        value: 8,
        info: info("VIF_TRANSMIT_PERIOD", "transmit_period"),
      },
      {
        description: "Alarm flags",
        type: EvaluatedDataType.String,
        unit: "",
        value: "no alarms",
        info: info("VIF_ERROR_FLAGS", "error_flags"),
      },
      {
        description: "Alarm flags; Previous value",
        type: EvaluatedDataType.String,
        unit: "",
        value: "no alarms",
        info: info("VIF_ERROR_FLAGS", "error_flags", {
          extensionNames: ["previous_value"],
        }),
      },
    ]);
  });
});

describe("Techem", () => {
  it("HCA #1 version 0x94", () => {
    const result = decode(
      "426c5f2c426e7500026c1936026e000002658e0a0265760a0d61e21800",
      { ...dummyMeter, manufacturer: "TCH", type: 0x80, version: 0x94 }
    );

    expect(result).toHaveLength(7);
    expect(result).toEqual([
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2018-12-31T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point", { storageNo: 1 }),
      },
      {
        description: "Units for H.C.A.",
        type: EvaluatedDataType.Number,
        unit: "",
        value: 117,
        info: info("VIF_HCA", "hca_units", { storageNo: 1 }),
      },
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2024-06-25T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point"),
      },
      {
        description: "Units for H.C.A.",
        type: EvaluatedDataType.Number,
        unit: "",
        value: 0,
        info: info("VIF_HCA", "hca_units"),
      },
      {
        description: "External Temperature",
        type: EvaluatedDataType.Number,
        unit: "°C",
        value: 27.02,
        info: info("VIF_EXTERNAL_TEMP", "external_temperature"),
      },
      {
        description: "External Temperature",
        type: EvaluatedDataType.Number,
        unit: "°C",
        value: 26.78,
        info: info("VIF_EXTERNAL_TEMP", "external_temperature"),
      },
      {
        description: "Temperature Difference",
        type: EvaluatedDataType.Number,
        unit: "K",
        value: 0.24,
        info: info("VIF_TEMP_DIFF", "temperature_difference"),
      },
    ]);
  });

  it("HCA #2 version 0x69", () => {
    const result = decode(
      "426c7f2c426e0204026c0832026e83000265c4080265f7090d61e2cdfe",
      { ...dummyMeter, manufacturer: "TCH", type: 0x80, version: 0x94 }
    );

    expect(result).toHaveLength(7);
    expect(result).toEqual([
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2019-12-31T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point", { storageNo: 1 }),
      },
      {
        description: "Units for H.C.A.",
        type: EvaluatedDataType.Number,
        unit: "",
        value: 1026,
        info: info("VIF_HCA", "hca_units", { storageNo: 1 }),
      },
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2024-02-08T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point"),
      },
      {
        description: "Units for H.C.A.",
        type: EvaluatedDataType.Number,
        unit: "",
        value: 131,
        info: info("VIF_HCA", "hca_units"),
      },
      {
        description: "External Temperature",
        type: EvaluatedDataType.Number,
        unit: "°C",
        value: 22.44,
        info: info("VIF_EXTERNAL_TEMP", "external_temperature"),
      },
      {
        description: "External Temperature",
        type: EvaluatedDataType.Number,
        unit: "°C",
        value: 25.51,
        info: info("VIF_EXTERNAL_TEMP", "external_temperature"),
      },
      {
        description: "Temperature Difference",
        type: EvaluatedDataType.Number,
        unit: "K",
        value: -3.07,
        info: info("VIF_TEMP_DIFF", "temperature_difference"),
      },
    ]);
  });

  it("Water meter 0x62", () => {
    const result = decode("426c5f2c42155900026c1b340215310003158a0000", {
      ...dummyMeter,
      manufacturer: "TCH",
      type: 0x62,
      version: 0x94,
    });

    expect(result).toHaveLength(5);
    expect(result).toEqual([
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2018-12-31T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point", { storageNo: 1 }),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 8.9,
        info: info("VIF_VOLUME", "volume", { storageNo: 1 }),
      },
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2024-04-27T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point"),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 4.9,
        info: info("VIF_VOLUME", "volume"),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 13.8,
        info: info("VIF_VOLUME", "volume"),
      },
    ]);
  });

  it("Water meter 0x72", () => {
    const result = decode("426c5f2c4215f304026c1936021575000315680500", {
      ...dummyMeter,
      manufacturer: "TCH",
      type: 0x72,
      version: 0x94,
    });

    expect(result).toHaveLength(5);
    expect(result).toEqual([
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2018-12-31T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point", { storageNo: 1 }),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 126.7,
        info: info("VIF_VOLUME", "volume", { storageNo: 1 }),
      },
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2024-06-25T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point"),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 11.7,
        info: info("VIF_VOLUME", "volume"),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 138.4,
        info: info("VIF_VOLUME", "volume"),
      },
    ]);
  });

  it("Heat meter 0x43", () => {
    const result = decode("426c7f2c4306770100026c1e3b03067800000406ef010000 ", {
      ...dummyMeter,
      manufacturer: "TCH",
      type: 0x43,
      version: 0x94,
    });

    expect(result).toHaveLength(5);
    expect(result).toEqual([
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2019-12-31T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point", { storageNo: 1 }),
      },
      {
        description: "Energy",
        type: EvaluatedDataType.Number,
        unit: "Wh",
        value: 375000,
        info: info("VIF_ENERGY_WATT", "energy", { storageNo: 1 }),
      },
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2024-11-30T00:00:00.000Z"),
        info: info("VIF_TIME_POINT_DATE", "time_point"),
      },
      {
        description: "Energy",
        type: EvaluatedDataType.Number,
        unit: "Wh",
        value: 120000,
        info: info("VIF_ENERGY_WATT", "energy"),
      },
      {
        description: "Energy",
        type: EvaluatedDataType.Number,
        unit: "Wh",
        value: 495000,
        info: info("VIF_ENERGY_WATT", "energy"),
      },
    ]);
  });
});

describe("Special DIF values", () => {
  it("DIF_NONE", () => {
    const result = decode("0013ff");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Volume",
        type: EvaluatedDataType.String,
        unit: "m³",
        value: "<null>",
        info: info("VIF_VOLUME", "volume"),
      },
    ]);
  });

  it("DIF_READOUT", () => {
    const result = decode("0813ff");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Volume",
        type: EvaluatedDataType.String,
        unit: "m³",
        value: "<null>",
        info: info("VIF_VOLUME", "volume"),
      },
    ]);
  });
});

describe("64 bit values", () => {
  it("stays a BigInt if the VIF does not scale the value", () => {
    // DIF 0x07 = INT64, VIF 0x03 = energy in Wh (no scaling)
    const result = decode("07038877665544332211");

    expect(result).toEqual([
      {
        description: "Energy",
        type: EvaluatedDataType.BigInt,
        unit: "Wh",
        value: 1234605616436508552n,
        info: info("VIF_ENERGY_WATT", "energy"),
      },
    ]);
  });

  it("becomes a Number if the VIF scales the value", () => {
    // DIF 0x07 = INT64, VIF 0x13 = volume in m³ (value / 1000)
    const result = decode("07138877665544332211");

    expect(result).toEqual([
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 1234605616436508.8,
        info: info("VIF_VOLUME", "volume"),
      },
    ]);
  });

  it("becomes a Number if a VIFE scales the value", () => {
    // DIF 0x07 = INT64, VIF 0x83 = energy in Wh + extension,
    // VIFE 0x70 = multiplicator 1e-6
    const result = decode("0783708877665544332211");

    expect(result).toEqual([
      {
        description: "Energy",
        type: EvaluatedDataType.Number,
        unit: "Wh",
        value: 1234605616436.5088,
        info: info("VIF_ENERGY_WATT", "energy"),
      },
    ]);
  });
});

describe("VIFE descriptors", () => {
  // every VIFE of the shipped tables modifies the given object, but the
  // descriptor may just as well return a new one - the result must be used
  it("A VIFE returning a new object is applied", () => {
    manufacturerSpecificsVifes["TST"] = [
      {
        vif: 0x01,
        legacyName: "VIF_TEST",
        description: "Test",
        apply: (_descriptor, _dataRecord, evaluatedData) => ({
          ...evaluatedData,
          unit: "replaced",
        }),
      },
    ];

    try {
      // INT8, volume with extension bit, VIFE 0x7f (manufacturer specific
      // follows) and the manufacturer specific VIFE 0x01
      const result = decode("0193ff012a", {
        ...dummyMeter,
        manufacturer: "TST",
      });

      expect(result).toHaveLength(1);
      expect(result[0].unit).toEqual("replaced");
    } finally {
      delete manufacturerSpecificsVifes["TST"];
    }
  });
});
