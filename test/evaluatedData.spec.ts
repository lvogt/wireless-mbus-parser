import { describe, expect, it } from "vitest";

import { decodeDataRecords } from "@/parser/dataRecords";
import { evaluateDataRecords } from "@/parser/evaluatedData";
import { EvaluatedDataType, type MeterType } from "@/types";

const dummyMeter: MeterType = {
  manufacturer: "ABC",
  version: 0x12,
  type: 0x42,
};

function decode(data: string, meterType?: MeterType) {
  const result = decodeDataRecords({ data: Buffer.from(data, "hex"), pos: 0 });
  return evaluateDataRecords(result.dataRecords, meterType ?? dummyMeter);
}

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
      },
      {
        description: "External Temperature",
        type: EvaluatedDataType.Number,
        unit: "°C",
        value: 21.7,
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 12.565,
      },
      {
        description: "Time point",
        type: EvaluatedDataType.DateTime,
        unit: "",
        value: new Date("2008-05-31T23:50:00.000Z"),
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 370240794.901,
      },
      {
        description: "Energy",
        type: EvaluatedDataType.BigInt,
        unit: "Wh",
        value: 30980n,
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
      },
      {
        description: "Volume Flow",
        type: EvaluatedDataType.Number,
        unit: "m³/h",
        value: 0.113,
      },
      {
        description: "Energy",
        type: EvaluatedDataType.Number,
        unit: "Wh",
        value: 218370,
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 28504.27,
      },
      {
        description:
          "Energy; Accumulation of abs value only if negative contributions",
        type: EvaluatedDataType.Number,
        unit: "Wh",
        value: 305.1,
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
      },
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
      },
    ]);
  });

  it("Single value - Volume - BCD", () => {
    const result = decode("0d13c512345678902f");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 9078563.412,
      },
    ]);
  });

  it("Single value - Energy - negative BCD", () => {
    const result = decode("0d13d51234567890");

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: -9078563.412,
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
      },
      {
        description: "Start of tariff",
        type: EvaluatedDataType.DateTime,
        unit: "",
        value: new Date("2008-05-31T23:50:00.000Z"),
      },
      {
        description: "Start of tariff",
        type: EvaluatedDataType.DateTime,
        unit: "",
        value: new Date("2026-04-22T18:52:22.000Z"),
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
      },
      {
        description: "Volume",
        type: EvaluatedDataType.Number,
        unit: "m³",
        value: 172.125,
      },
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2022-04-01T00:00:00.000Z"),
      },
      {
        description: "Remaining battery life",
        type: EvaluatedDataType.Number,
        unit: "month",
        value: 156,
      },
      {
        description: "Transmit period",
        type: EvaluatedDataType.Number,
        unit: "s",
        value: 8,
      },
      {
        description: "Alarm flags",
        type: EvaluatedDataType.String,
        unit: "",
        value: "no alarms",
      },
      {
        description: "Alarm flags; Previous value",
        type: EvaluatedDataType.String,
        unit: "",
        value: "no alarms",
      },
    ]);
  });
});

describe("Techem", () => {
  it("HCA", () => {
    const result = decode(
      "426c5f2c426e7500026c1936026e000002658e0a0265760a02611800",
      { manufacturer: "TCH", type: 0x80, version: 0x94 }
    );

    expect(result).toHaveLength(7);
    expect(result).toEqual([
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2018-12-31T00:00:00.000Z"),
      },
      {
        description: "Units for H.C.A.",
        type: EvaluatedDataType.Number,
        unit: "",
        value: 117,
      },
      {
        description: "Time point",
        type: EvaluatedDataType.Date,
        unit: "",
        value: new Date("2024-06-25T00:00:00.000Z"),
      },
      {
        description: "Units for H.C.A.",
        type: EvaluatedDataType.Number,
        unit: "",
        value: 0,
      },
      {
        description: "External Temperature",
        type: 0,
        unit: "°C",
        value: 27.02,
      },
      {
        description: "External Temperature",
        type: 0,
        unit: "°C",
        value: 26.78,
      },
      {
        description: "Temperature Difference",
        type: 0,
        unit: "K",
        value: 0.24,
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
      },
    ]);
  });
});
