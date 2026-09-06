import { afterEach, describe, expect, it } from "vitest";

import { manufacturerSpecificHandlers } from "@/manufacturerSpecificData/handler";
import { WirelessMbusParser } from "@/parser/parser";
import { EvaluatedDataType } from "@/types";

// TST, one data record with a manufacturer specific VIF (0xff 0x11) holding
// 10 bytes of binary data
const TELEGRAM = "1844745278563412020178" + "0dff11ea" + "0102030405060708090a";

// a volume record, a 4 byte blob (decoded as a number) and a 10 byte one
const MIXED_TELEGRAM =
  "2644745278563412020178" +
  "0413e8030000" +
  "0dff11e401020304" +
  "0dff12ea0102030405060708090a";

// an Itron smoke detector, captured from a device, decrypted and with the
// encryption flag of the configuration word cleared, so that no key is needed
// here. The identification number is replaced as well.
const REAL_SMOKE_DETECTOR =
  "4e44972678563412001a7a21130000" +
  "2f2f066d1220ee483200" +
  "077f80802002533e170c" +
  "0f0000010100000101000001012927283418311b39000001010000010100000000" +
  "14310f370d00460100002f";

async function decode(telegram = TELEGRAM) {
  const parser = new WirelessMbusParser();
  return await parser.parse(Buffer.from(telegram, "hex"), {
    verbose: true,
    containsCrc: false,
  });
}

afterEach(() => {
  delete manufacturerSpecificHandlers["TST"];
});

describe("Manufacturer specific data", () => {
  it("The blob is kept as is without a handler", async () => {
    const result = await decode();

    expect(result.meter.manufacturer).toEqual("TST");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].value).toEqual("0102030405060708090a");
    expect(result.dataRecords).toHaveLength(1);
  });

  it("A handler adds one entry per extracted value", async () => {
    manufacturerSpecificHandlers["TST"] = (data) => [
      { description: "Tamper", value: data[0] & 0x01 ? "yes" : "no" },
      { description: "Battery", value: data[1], unit: "%" },
      { description: "Counter", value: data.readUInt16LE(2), storageNo: 1 },
    ];

    const result = await decode();

    expect(result.data).toHaveLength(4);
    expect(result.data.slice(1)).toEqual([
      {
        value: "yes",
        unit: "",
        description: "Tamper",
        type: EvaluatedDataType.String,
        info: {
          legacyVif: "VIF_MANUFACTURER_SPECIFIC",
          tariff: 0,
          deviceUnit: 0,
          storageNo: 0,
        },
      },
      {
        value: 2,
        unit: "%",
        description: "Battery",
        type: EvaluatedDataType.Number,
        info: {
          legacyVif: "VIF_MANUFACTURER_SPECIFIC",
          tariff: 0,
          deviceUnit: 0,
          storageNo: 0,
        },
      },
      {
        value: 0x0403,
        unit: "",
        description: "Counter",
        type: EvaluatedDataType.Number,
        info: {
          legacyVif: "VIF_MANUFACTURER_SPECIFIC",
          tariff: 0,
          deviceUnit: 0,
          storageNo: 1,
        },
      },
    ]);
  });

  it("The extracted values are appended, keeping the telegram order intact", async () => {
    manufacturerSpecificHandlers["TST"] = (data) => [
      {
        description: `blob of ${data.length} bytes`,
        value: data.toString("hex"),
      },
    ];

    const result = await decode(MIXED_TELEGRAM);

    expect(result.data.map((d) => d.description)).toEqual([
      // the records of the telegram keep their position
      "Volume",
      "Unknown manufacturer specific VIF 0x11",
      "Unknown manufacturer specific VIF 0x12",
      // the extracted values follow
      "blob of 4 bytes",
      "blob of 10 bytes",
    ]);
  });

  it("Data records stay untouched, they describe the telegram", async () => {
    manufacturerSpecificHandlers["TST"] = (data) => [
      { description: "Status", value: data[0] },
    ];

    const result = await decode();

    expect(result.dataRecords).toHaveLength(1);
    expect(result.data).toHaveLength(2);

    const legacy = WirelessMbusParser.toLegacyResult(result);
    expect(legacy.dataRecord).toHaveLength(2);
    expect(legacy.dataRecord[1].description).toEqual("Status");
  });

  it("Blobs of a compact frame are decoded as well", async () => {
    const seen: string[] = [];
    manufacturerSpecificHandlers["TST"] = (data) => {
      seen.push(data.toString("hex"));
      return [{ description: "raw", value: data.toString("hex") }];
    };

    const parser = new WirelessMbusParser();
    const full = await parser.parse(Buffer.from(MIXED_TELEGRAM, "hex"), {
      verbose: true,
      containsCrc: false,
    });
    seen.length = 0;

    // the same meter as a compact frame: only the values, the headers are
    // taken from the cache, so their offsets point into the full telegram
    const compact =
      "2244745278563412020179e6070000" +
      "e8030000" +
      "e401020304" +
      "ea0102030405060708090a";

    const cachedParser = new WirelessMbusParser({
      cachedDataRecordHeaders: [
        WirelessMbusParser.getDataRecordHeadersCacheEntry(full),
      ],
    });
    const result = await cachedParser.parse(Buffer.from(compact, "hex"), {
      verbose: true,
      containsCrc: false,
    });

    // the bytes are collected while the values are decoded, so a compact frame
    // works the same way - the offsets of its cached headers point into the
    // full telegram and are never used
    expect(seen).toEqual(["01020304", "0102030405060708090a"]);
    expect(result.dataRecords).toHaveLength(3);
    expect(result.data).toHaveLength(5);
  });

  it("The properties of the record are carried over", async () => {
    manufacturerSpecificHandlers["TST"] = () =>
      [
        { description: "Inherited" },
        { description: "Own", storageNo: 7, tariff: 3 },
      ].map((v) => ({ ...v, value: 1 }));

    // DIF 0xdd: maximum value, VARLEN, with a DIFE adding storage and tariff
    const telegram = "1344745278563412020178" + "dd11ff11e4" + "01020304";
    const result = await decode(telegram);
    const [inherited, own] = result.data.slice(1);

    expect(result.dataRecords[0].header.dib).toMatchObject({
      functionField: 1,
      storageNo: 3,
      tariff: 1,
    });
    // the function field of the record describes its values as well
    expect(inherited.description).toEqual("Inherited (maximum value)");
    expect(inherited.info).toMatchObject({ storageNo: 3, tariff: 1 });
    // unless the handler states something else
    expect(own.info).toMatchObject({ storageNo: 7, tariff: 3 });
  });

  it("A throwing handler does not cost the rest of the telegram", async () => {
    manufacturerSpecificHandlers["TST"] = () => {
      throw new Error("broken handler");
    };

    const result = await decode();

    expect(result.data).toHaveLength(1);
    expect(result.data[0].value).toEqual("0102030405060708090a");
  });
});

describe("Configured handlers", () => {
  const handler = (data: Buffer) => [
    { description: "Configured", value: data[0] },
  ];

  it("A handler of the configuration is used", async () => {
    const parser = new WirelessMbusParser({
      manufacturerSpecificHandlers: { TST: handler },
    });
    const result = await parser.parse(Buffer.from(TELEGRAM, "hex"), {
      verbose: true,
      containsCrc: false,
    });

    expect(result.data).toHaveLength(2);
    expect(result.data[1].description).toEqual("Configured");
    expect(result.data[1].value).toEqual(0x01);
  });

  it("It only applies to the parser it was given to", async () => {
    const configured = new WirelessMbusParser({
      manufacturerSpecificHandlers: { TST: handler },
    });
    await configured.parse(Buffer.from(TELEGRAM, "hex"), {
      containsCrc: false,
    });

    const plain = new WirelessMbusParser();
    const result = await plain.parse(Buffer.from(TELEGRAM, "hex"), {
      containsCrc: false,
    });

    expect(result.data).toHaveLength(1);
  });

  it("It takes precedence over a handler of the parser", async () => {
    const parser = new WirelessMbusParser({
      manufacturerSpecificHandlers: {
        ITW: () => [{ description: "Replaced", value: 1 }],
      },
    });
    const result = await parser.parse(Buffer.from(REAL_SMOKE_DETECTOR, "hex"), {
      verbose: true,
      containsCrc: false,
    });

    expect(result.data.map((entry) => entry.description)).toEqual([
      "Time point",
      "Unknown manufacturer specific VIF 0x7f",
      "Replaced",
    ]);
  });

  it("Handlers of the parser are used for other manufacturers", async () => {
    const parser = new WirelessMbusParser({
      manufacturerSpecificHandlers: { TST: handler },
    });
    const result = await parser.parse(Buffer.from(REAL_SMOKE_DETECTOR, "hex"), {
      verbose: true,
      containsCrc: false,
    });

    expect(result.data).toHaveLength(28);
  });
});

describe("Itron", () => {
  // ITW, device type 0x1a (smoke detector), a volume record and the 64 bit
  // manufacturer specific record with the configuration and error codes
  const SMOKE_DETECTOR =
    "1e44972678563412071a" +
    "7a2a000000" +
    "0413e8030000" +
    "077f" +
    "80418002783e061f";

  async function decodeRealSmokeDetector() {
    const parser = new WirelessMbusParser();
    return await parser.parse(Buffer.from(REAL_SMOKE_DETECTOR, "hex"), {
      verbose: true,
      containsCrc: false,
    });
  }

  async function decodeSmokeDetector() {
    const parser = new WirelessMbusParser();
    return await parser.parse(Buffer.from(SMOKE_DETECTOR, "hex"), {
      verbose: true,
      containsCrc: false,
    });
  }

  function valueOf(
    data: Awaited<ReturnType<typeof decodeSmokeDetector>>["data"],
    description: string
  ) {
    return data.find((entry) => entry.description === description)?.value;
  }

  it("Decodes the configuration and error codes", async () => {
    const result = await decodeSmokeDetector();

    expect(result.meter).toMatchObject({
      manufacturer: "ITW",
      type: 0x1a,
    });

    // the two records of the telegram plus one entry per named bit
    expect(result.dataRecords).toHaveLength(2);
    expect(result.data).toHaveLength(28);

    const { data } = result;
    // config byte 0x80
    expect(valueOf(data, "Transmitted data encrypted")).toEqual(1);
    // modem error byte 0x41
    expect(valueOf(data, "Code corrupt")).toEqual(1);
    expect(valueOf(data, "Low battery")).toEqual(1);
    expect(valueOf(data, "Removal")).toEqual(0);
    // smoke detector error bytes 0x0280
    expect(valueOf(data, "Warning: smoke alarm")).toEqual(1);
    expect(
      valueOf(data, "Warning: no test done during the last period")
    ).toEqual(1);
    expect(valueOf(data, "Warning: smoke inlet blocking")).toEqual(0);
    // status byte 0x06
    expect(valueOf(data, "Product installed")).toEqual(1);
    expect(valueOf(data, "Removal occurred")).toEqual(0);
    expect(valueOf(data, "Network mode")).toEqual("Walk-by");
    // remaining bytes
    expect(valueOf(data, "Remaining battery lifetime")).toEqual(120);
    expect(valueOf(data, "Product code")).toEqual(0x3e);
    expect(valueOf(data, "Fixed date billing")).toEqual(31);
  });

  it("Reports the battery lifetime in months", async () => {
    const result = await decodeSmokeDetector();
    const battery = result.data.find(
      (entry) => entry.description === "Remaining battery lifetime"
    );

    expect(battery?.unit).toEqual("month");
    expect(battery?.type).toEqual(EvaluatedDataType.Number);
  });

  it("Reserved bits are not reported", async () => {
    const result = await decodeSmokeDetector();

    expect(
      result.data.filter((entry) => entry.description.includes("eserved"))
    ).toEqual([]);
  });

  it("Decodes a telegram of a real smoke detector", async () => {
    const result = await decodeRealSmokeDetector();

    expect(result.meter).toMatchObject({
      manufacturer: "ITW",
      id: "12345678",
      type: 0x1a,
      deviceType: "Smokedetector",
      // any error bit sets the alarm state of the link layer as well
      status: "Alarm (temporary)",
    });

    const { data } = result;
    expect(data[0].value).toEqual(new Date("2026-02-08T14:32:18.000Z"));

    // the telegram was encrypted, which the configuration byte states as well
    expect(valueOf(data, "Transmitted data encrypted")).toEqual(1);
    // 0x3e is the product code of the smoke detector module
    expect(valueOf(data, "Product code")).toEqual(0x3e);

    expect(valueOf(data, "Removal")).toEqual(1);
    expect(valueOf(data, "Removal occurred")).toEqual(1);
    expect(valueOf(data, "Warning: perimeter intrusion")).toEqual(1);
    expect(valueOf(data, "Perimeter intrusion occurred")).toEqual(1);
    expect(
      valueOf(data, "Warning: no test done during the last period")
    ).toEqual(1);
    expect(valueOf(data, "Warning: smoke alarm")).toEqual(0);
    expect(valueOf(data, "Product installed")).toEqual(1);
    expect(valueOf(data, "Network mode")).toEqual("Walk-by");
    expect(valueOf(data, "Remaining battery lifetime")).toEqual(83);
    expect(valueOf(data, "Fixed date billing")).toEqual(12);
  });

  it("Legacy result of a real smoke detector", async () => {
    const result = await decodeRealSmokeDetector();

    expect(WirelessMbusParser.toLegacyResult(result)).toMatchSnapshot();
  });

  it("Other Itron devices yield no additional values", async () => {
    // the same telegram, but device type 0x07 (water) instead of 0x1a
    const parser = new WirelessMbusParser();
    const result = await parser.parse(
      Buffer.from(SMOKE_DETECTOR.replace("071a", "0707"), "hex"),
      { verbose: true, containsCrc: false }
    );

    expect(result.data).toHaveLength(2);
  });
});
