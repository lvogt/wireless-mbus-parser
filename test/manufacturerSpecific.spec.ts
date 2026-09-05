import { describe, expect, it } from "vitest";

import { WirelessMbusParser } from "@/parser/parser";
import { EvaluatedDataType } from "@/types";

async function decode(data: string) {
  const parser = new WirelessMbusParser();
  return await parser.parse(Buffer.from(data, "hex"), {
    verbose: true,
    containsCrc: false,
  });
}

async function decodeWithCrcAutoDetection(data: string) {
  const parser = new WirelessMbusParser();
  return await parser.parse(Buffer.from(data, "hex"), { verbose: true });
}

function info(
  legacyVif: string,
  dib?: { storageNo?: number; deviceUnit?: number; tariff?: number }
) {
  return {
    legacyVif,
    storageNo: dib?.storageNo ?? 0,
    deviceUnit: dib?.deviceUnit ?? 0,
    tariff: dib?.tariff ?? 0,
  };
}

function date(value: string) {
  return new Date(value);
}

describe("Techem", () => {
  it("HCA version 0x94", async () => {
    const result = await decode(
      "33446850942905119480a20f9f257500902d0000018e0a760a000000000000000000000000000000000000000000000000000000"
    );

    expect(result.meter).toEqual({
      manufacturer: "TCH",
      id: "11052994",
      type: 0x80,
      deviceType: "Heat cost allocator (TCH)",
      version: 0x94,
    });

    expect(result.data).toEqual([
      {
        value: date("2018-12-31T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE", { storageNo: 1 }),
      },
      {
        value: 117,
        unit: "",
        description: "Units for H.C.A.",
        type: EvaluatedDataType.Number,
        info: info("VIF_HCA", { storageNo: 1 }),
      },
      {
        value: date("2019-06-25T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE"),
      },
      {
        value: 0,
        unit: "",
        description: "Units for H.C.A.",
        type: EvaluatedDataType.Number,
        info: info("VIF_HCA"),
      },
      {
        value: 27.02,
        unit: "°C",
        description: "External Temperature",
        type: EvaluatedDataType.Number,
        info: info("VIF_EXTERNAL_TEMP"),
      },
      {
        value: 26.78,
        unit: "°C",
        description: "External Temperature",
        type: EvaluatedDataType.Number,
        info: info("VIF_EXTERNAL_TEMP"),
      },
      {
        value: 0.24,
        unit: "K",
        description: "Temperature Difference",
        type: EvaluatedDataType.Number,
        info: info("VIF_TEMP_DIFF"),
      },
    ]);
  });

  it("Current date falls back to the current year without a last period date", async () => {
    // same telegram as above, but with the last period date zeroed out, so
    // there is nothing to anchor the year of the current date on
    const result = await decode(
      "33446850942905119480a20f00007500902d0000018e0a760a000000000000000000000000000000000000000000000000000000"
    );

    const currentDate = result.data.find(
      (data) =>
        data.info.legacyVif === "VIF_TIME_POINT_DATE" &&
        data.info.storageNo === 0
    );

    // day and month are taken from the telegram, the year from the wall clock
    expect(currentDate?.value).toEqual(
      new Date(new Date().getFullYear(), 5, 25)
    );
  });

  it("HCA version 0x69", async () => {
    const result = await decode(
      "31446850226677116980A0119F27020480048300C408F709143C003D341A2B0B2A0707000000000000062D114457563D71A1850000"
    );

    expect(result.meter).toEqual({
      manufacturer: "TCH",
      id: "11776622",
      type: 0x80,
      deviceType: "Heat cost allocator (TCH)",
      version: 0x69,
    });

    expect(result.data).toEqual([
      {
        value: date("2019-12-31T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE", { storageNo: 1 }),
      },
      {
        value: 1026,
        unit: "",
        description: "Units for H.C.A.",
        type: EvaluatedDataType.Number,
        info: info("VIF_HCA", { storageNo: 1 }),
      },
      {
        value: date("2020-02-08T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE"),
      },
      {
        value: 131,
        unit: "",
        description: "Units for H.C.A.",
        type: EvaluatedDataType.Number,
        info: info("VIF_HCA"),
      },
      {
        value: 22.44,
        unit: "°C",
        description: "External Temperature",
        type: EvaluatedDataType.Number,
        info: info("VIF_EXTERNAL_TEMP"),
      },
      {
        value: 25.51,
        unit: "°C",
        description: "External Temperature",
        type: EvaluatedDataType.Number,
        info: info("VIF_EXTERNAL_TEMP"),
      },
      {
        value: -3.07,
        unit: "K",
        description: "Temperature Difference",
        type: EvaluatedDataType.Number,
        info: info("VIF_TEMP_DIFF"),
      },
    ]);
  });

  it("HCA version 0x69 with CRC auto detection", async () => {
    // the telegram has 3 trailing bytes and no CRC
    const result = await decodeWithCrcAutoDetection(
      "31446850226677116980A0119F27020480048300C408F709143C003D341A2B0B2A0707000000000000062D114457563D71A1850000"
    );

    expect(result.data.map((data) => data.value)).toEqual([
      date("2019-12-31T00:00:00.000Z"),
      1026,
      date("2020-02-08T00:00:00.000Z"),
      131,
      22.44,
      25.51,
      -3.07,
    ]);
  });

  it("Hot water meter type 0x62", async () => {
    const result = await decode(
      "2F446850313233347462A2069F255900B029310000000306060906030609070606050509050505050407040605070500"
    );

    expect(result.meter).toEqual({
      manufacturer: "TCH",
      id: "34333231",
      type: 0x62,
      deviceType: "Hot water meter (TCH)",
      version: 0x74,
    });

    expect(result.data).toEqual([
      {
        value: date("2018-12-31T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE", { storageNo: 1 }),
      },
      {
        value: 8.9,
        unit: "m³",
        description: "Volume",
        type: EvaluatedDataType.Number,
        info: info("VIF_VOLUME", { storageNo: 1 }),
      },
      {
        value: date("2019-04-27T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE"),
      },
      {
        value: 4.9,
        unit: "m³",
        description: "Volume",
        type: EvaluatedDataType.Number,
        info: info("VIF_VOLUME"),
      },
      {
        // total = current period + last period
        value: 13.8,
        unit: "m³",
        description: "Volume",
        type: EvaluatedDataType.Number,
        info: info("VIF_VOLUME"),
      },
    ]);
  });

  it("Hot water meter ignores the byte behind the current period volume", async () => {
    // same telegram as above, but the byte behind the 16 bit current period
    // volume is set - it must not be read as part of the volume
    const result = await decode(
      "2f446850313233347462a2069f255900b0293100ff000306060906030609070606050509050505050407040605070500"
    );

    const volume = result.data.filter((data) => data.unit === "m³");

    expect(volume.map((data) => data.value)).toEqual([8.9, 4.9, 13.8]);
  });

  it("Cold water meter type 0x72", async () => {
    const result = await decode(
      "2f446850567325307472a2069f25f304902d750000000000000000010c1312120e1211100f0e0e0f1111121214171312"
    );

    expect(result.meter).toEqual({
      manufacturer: "TCH",
      id: "30257356",
      type: 0x72,
      deviceType: "Cold water meter (TCH)",
      version: 0x74,
    });

    expect(result.data).toEqual([
      {
        value: date("2018-12-31T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE", { storageNo: 1 }),
      },
      {
        value: 126.7,
        unit: "m³",
        description: "Volume",
        type: EvaluatedDataType.Number,
        info: info("VIF_VOLUME", { storageNo: 1 }),
      },
      {
        value: date("2019-06-25T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE"),
      },
      {
        value: 11.7,
        unit: "m³",
        description: "Volume",
        type: EvaluatedDataType.Number,
        info: info("VIF_VOLUME"),
      },
      {
        value: 138.4,
        unit: "m³",
        description: "Volume",
        type: EvaluatedDataType.Number,
        info: info("VIF_VOLUME"),
      },
    ]);
  });

  it("Heat meter type 0x43", async () => {
    const result = await decode(
      "36446850626262624543A1009F2777010060780000000A000000000000000000000000000000000000000000000000A0400000B4010000"
    );

    expect(result.meter).toEqual({
      manufacturer: "TCH",
      id: "62626262",
      type: 0x43,
      deviceType: "Heat meter (TCH)",
      version: 0x45,
    });

    expect(result.data).toEqual([
      {
        value: date("2019-12-31T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE", { storageNo: 1 }),
      },
      {
        value: 375000,
        unit: "Wh",
        description: "Energy",
        type: EvaluatedDataType.Number,
        info: info("VIF_ENERGY_WATT", { storageNo: 1 }),
      },
      {
        value: date("2020-12-20T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE"),
      },
      {
        value: 120000,
        unit: "Wh",
        description: "Energy",
        type: EvaluatedDataType.Number,
        info: info("VIF_ENERGY_WATT"),
      },
      {
        // total = current period + last period
        value: 495000,
        unit: "Wh",
        description: "Energy",
        type: EvaluatedDataType.Number,
        info: info("VIF_ENERGY_WATT"),
      },
    ]);
  });

  it("Heat meter with a current period energy above 16 bit", async () => {
    // same telegram as above, but the current period energy is 0x010078 kWh
    const result = await decode(
      "36446850626262624543A1009F2777010060780001000A000000000000000000000000000000000000000000000000A0400000B4010000"
    );

    const energy = result.data.filter((data) => data.unit === "Wh");

    expect(energy.map((data) => data.value)).toEqual([
      375000, 65656000,
      // the 24 bit current period value must not be truncated to 16 bit
      66031000,
    ]);
  });
});

describe("PRIOS", () => {
  it("Water meter", async () => {
    const result = await decode(
      "1944a511780727324120a2211a00136d7417074c0dcb9661a3ab"
    );

    expect(result.meter).toEqual({
      manufacturer: "DME",
      id: "20413227",
      type: 0x07,
      deviceType: "Water",
      version: 0x78,
    });

    expect(result.data).toEqual([
      {
        value: 175.854,
        unit: "m³",
        description: "Volume",
        type: EvaluatedDataType.Number,
        info: info("VIF_VOLUME"),
      },
      {
        value: 172.125,
        unit: "m³",
        description: "Volume",
        type: EvaluatedDataType.Number,
        info: info("VIF_VOLUME", { storageNo: 1 }),
      },
      {
        value: date("2022-04-01T00:00:00.000Z"),
        unit: "",
        description: "Time point",
        type: EvaluatedDataType.Date,
        info: info("VIF_TIME_POINT_DATE", { storageNo: 1 }),
      },
      {
        value: 156,
        unit: "month",
        description: "Remaining battery life",
        type: EvaluatedDataType.Number,
        info: info("VIF_BATTERY_REMAINING"),
      },
      {
        value: 8,
        unit: "s",
        description: "Transmit period",
        type: EvaluatedDataType.Number,
        info: info("VIF_TRANSMIT_PERIOD"),
      },
      {
        value: "no alarms",
        unit: "",
        description: "Alarm flags",
        type: EvaluatedDataType.String,
        info: info("VIF_ERROR_FLAGS"),
      },
      {
        value: "no alarms",
        unit: "",
        description: "Alarm flags; Previous value",
        type: EvaluatedDataType.String,
        info: info("VIF_ERROR_FLAGS"),
      },
    ]);
  });
});
