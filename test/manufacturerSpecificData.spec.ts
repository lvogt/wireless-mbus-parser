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
