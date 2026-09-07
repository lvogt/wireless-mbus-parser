import { afterEach, describe, expect, it } from "vitest";

import { createManufacturerSpecificHandler } from "@/manufacturerSpecificData/fieldSpec";
import { manufacturerSpecificHandlers } from "@/manufacturerSpecificData/handler";
import { WirelessMbusParser } from "@/parser/parser";
import type {
  EvaluatedData,
  ManufacturerSpecificFieldSpec,
  ManufacturerSpecificLayout,
  ManufacturerSpecificValue,
} from "@/types";
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
          legacyVif: "VIF_TAMPER",
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
          legacyVif: "VIF_BATTERY",
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
          legacyVif: "VIF_COUNTER",
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
    expect(valueOf(data, "Data encrypted")).toEqual(1);
    // modem error byte 0x41
    expect(valueOf(data, "Modem code corrupt")).toEqual(1);
    expect(valueOf(data, "Modem low battery")).toEqual(1);
    expect(valueOf(data, "Modem removal")).toEqual(0);
    // smoke detector error bytes 0x0280
    expect(valueOf(data, "Warning: smoke alarm")).toEqual(1);
    expect(valueOf(data, "Warning: no test in last period")).toEqual(1);
    expect(valueOf(data, "Warning: inlet blocking")).toEqual(0);
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
    expect(valueOf(data, "Data encrypted")).toEqual(1);
    // 0x3e is the product code of the smoke detector module
    expect(valueOf(data, "Product code")).toEqual(0x3e);

    expect(valueOf(data, "Modem removal")).toEqual(1);
    expect(valueOf(data, "Removal occurred")).toEqual(1);
    expect(valueOf(data, "Warning: intrusion")).toEqual(1);
    expect(valueOf(data, "Intrusion occurred")).toEqual(1);
    expect(valueOf(data, "Warning: no test in last period")).toEqual(1);
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

describe("Declarative handlers", () => {
  // the blob of TELEGRAM is 0102030405060708090a
  async function decodeWith(
    spec: ManufacturerSpecificFieldSpec[] | ManufacturerSpecificLayout[],
    telegram = TELEGRAM
  ) {
    manufacturerSpecificHandlers["TST"] =
      createManufacturerSpecificHandler(spec);
    const { data } = await decode(telegram);
    return data;
  }

  function valueOf(data: EvaluatedData[], description: string) {
    return data.find((entry) => entry.description === description)?.value;
  }

  it("Reads bytes, bits and ranges of bits", async () => {
    const data = await decodeWith([
      { byte: 0, description: "Byte" },
      { byte: 0, bytes: 2, description: "Word" },
      { byte: 1, bit: 1, description: "Bit" },
      { byte: 1, bit: 0, description: "Other bit" },
      { byte: 2, bits: [0, 3], description: "Nibble" },
    ]);

    expect(valueOf(data, "Byte")).toEqual(0x01);
    expect(valueOf(data, "Word")).toEqual(0x0201);
    expect(valueOf(data, "Bit")).toEqual(1);
    expect(valueOf(data, "Other bit")).toEqual(0);
    expect(valueOf(data, "Nibble")).toEqual(0x3);
  });

  it("A range of bits can span a byte boundary", async () => {
    const data = await decodeWith([
      // bits 7 to 9 of 0x0201: the most significant bit of the first byte and
      // the two least significant ones of the second
      { byte: 0, bytes: 2, bits: [7, 9], description: "Spanning" },
    ]);

    expect(valueOf(data, "Spanning")).toEqual(0b100);
  });

  it("Fields wider than the bitwise operators are read as well", async () => {
    const data = await decodeWith([
      { byte: 0, bytes: 6, description: "Wide" },
      { byte: 0, bytes: 6, bits: [40, 47], description: "Top byte" },
    ]);

    expect(valueOf(data, "Wide")).toEqual(0x060504030201);
    expect(valueOf(data, "Top byte")).toEqual(0x06);
  });

  it("Flags yield one value per named bit", async () => {
    const data = await decodeWith([
      { byte: 0, flags: ["Set", null, "Cleared"] },
      { byte: 4, bytes: 2, flags: [null, null, "High"] },
    ]);

    // the reserved bits are skipped
    expect(data.slice(1).map((entry) => entry.description)).toEqual([
      "Set",
      "Cleared",
      "High",
    ]);
    expect(valueOf(data, "Set")).toEqual(1);
    expect(valueOf(data, "Cleared")).toEqual(0);
    // 0x0605 >> 2
    expect(valueOf(data, "High")).toEqual(1);
  });

  it("A value can be named", async () => {
    const data = await decodeWith([
      { byte: 0, bits: [0, 1], description: "Mode", values: ["Off", "On"] },
      {
        byte: 1,
        bits: [0, 1],
        description: "State",
        values: ["Off", "On", "Standby"],
      },
      { byte: 2, description: "Unnamed", values: ["Off", "On"] },
    ]);

    expect(valueOf(data, "Mode")).toEqual("On");
    expect(valueOf(data, "State")).toEqual("Standby");
    // a value without a name stays the number it is
    expect(valueOf(data, "Unnamed")).toEqual(0x03);
  });

  it("Unit, storage number and tariff are taken from the field", async () => {
    const data = await decodeWith([
      {
        byte: 4,
        description: "Battery",
        unit: "%",
        legacyName: "VIF_BATTERY",
        storageNo: 2,
        tariff: 1,
      },
    ]);

    expect(data[1]).toMatchObject({
      value: 0x05,
      unit: "%",
      info: { legacyVif: "VIF_BATTERY", storageNo: 2, tariff: 1 },
    });
  });

  it("A layout is chosen by the device type", async () => {
    // the telegram states device type 0x01
    const layouts: ManufacturerSpecificLayout[] = [
      { deviceType: 0x02, fields: [{ byte: 0, description: "Wrong type" }] },
      {
        deviceType: [0x00, 0x01],
        fields: [{ byte: 0, description: "Right type" }],
      },
      { fields: [{ byte: 0, description: "Fallback" }] },
    ];

    const data = await decodeWith(layouts);

    // only the first matching layout is used
    expect(data.slice(1).map((entry) => entry.description)).toEqual([
      "Right type",
    ]);
  });

  it("A layout is chosen by the VIF of the record", async () => {
    const data = await decodeWith(
      [
        { vif: 0x11, fields: [{ byte: 0, description: "First blob" }] },
        { vif: 0x12, fields: [{ byte: 0, description: "Second blob" }] },
      ],
      MIXED_TELEGRAM
    );

    expect(data.map((entry) => entry.description)).toEqual([
      "Volume",
      "Unknown manufacturer specific VIF 0x11",
      "Unknown manufacturer specific VIF 0x12",
      "First blob",
      "Second blob",
    ]);
  });

  it("A blob no layout matches yields no values", async () => {
    const data = await decodeWith([
      { deviceType: 0x02, fields: [{ byte: 0, description: "Wrong type" }] },
    ]);

    expect(data).toHaveLength(1);
  });

  it("A blob too short for its layout yields no values", async () => {
    // the first blob of the telegram is 4 bytes, the second one 10
    const data = await decodeWith(
      [{ byte: 5, description: "Sixth byte" }],
      MIXED_TELEGRAM
    );

    expect(data.slice(3)).toHaveLength(1);
    expect(valueOf(data, "Sixth byte")).toEqual(0x06);
  });

  it("It can be passed to the parser as well", async () => {
    const parser = new WirelessMbusParser({
      manufacturerSpecificHandlers: {
        TST: createManufacturerSpecificHandler([
          { byte: 0, description: "Configured" },
        ]),
      },
    });
    const result = await parser.parse(Buffer.from(TELEGRAM, "hex"), {
      containsCrc: false,
    });

    expect(result.data[1].description).toEqual("Configured");
  });

  it("An unsound description is rejected", () => {
    const create = (spec: ManufacturerSpecificFieldSpec[]) => () =>
      createManufacturerSpecificHandler(spec);

    expect(create([{ byte: -1, description: "Negative" }])).toThrowError(
      "-1 is not a byte offset"
    );
    expect(create([{ byte: 0.5, description: "Fraction" }])).toThrowError(
      "0.5 is not a byte offset"
    );
    expect(create([{ byte: 0, bytes: 7, description: "Wide" }])).toThrowError(
      "the field at byte 0 is not 1 to 6 bytes wide"
    );
    expect(create([{ byte: 0, bytes: 0, description: "Empty" }])).toThrowError(
      "the field at byte 0 is not 1 to 6 bytes wide"
    );
    expect(create([{ byte: 1, bit: 8, description: "Bit" }])).toThrowError(
      "bit 8 is outside of the field at byte 1 (Bit)"
    );
    expect(
      create([{ byte: 1, bytes: 2, bits: [8, 16], description: "Range" }])
    ).toThrowError("bit 16 is outside of the field at byte 1 (Range)");
    expect(
      create([{ byte: 1, bits: [4, 2], description: "Backwards" }])
    ).toThrowError("the bit range of byte 1 (Backwards) ends before it starts");
    expect(
      create([{ byte: 1, bit: 0, bits: [0, 1], description: "Both" }])
    ).toThrowError("byte 1 (Both) states both a bit and a bit range");
    expect(create([{ byte: 0, description: "" }])).toThrowError(
      "the field at byte 0 has no description"
    );
    expect(
      create([{ byte: 0, bytes: 6, flags: ["a", "b"] }])
    ).not.toThrowError();
    expect(
      create([{ byte: 0, flags: new Array(9).fill("f") } as never])
    ).toThrowError("there are more flags than bits at byte 0 (flags)");
    expect(
      create([{ byte: 0, flags: ["a"], description: "Both" } as never])
    ).toThrowError("byte 0 (Both) states both flags and a description");
    expect(
      create([
        { byte: 0, description: "Field" },
        { fields: [{ byte: 0, description: "Layout" }] },
      ] as never)
    ).toThrowError("fields and layouts cannot be mixed in one list");
  });

  // a description can be read from a configuration file, so it is not
  // necessarily type checked
  it("A description which is not even a description is rejected", () => {
    const create = (spec: unknown) => () =>
      createManufacturerSpecificHandler(spec as never);

    expect(create("nonsense")).toThrowError(
      "expected a list of fields or layouts"
    );
    expect(create([{ byte: 0, bits: [1], description: "Range" }])).toThrowError(
      "the bit range of byte 0 (Range) is not a pair of bits"
    );
    expect(
      create([{ byte: 0, description: "Names", values: "Off" }])
    ).toThrowError("the value names of byte 0 (Names) are not strings");
    expect(create([{ byte: 0, flags: "Leakage" }])).toThrowError(
      "the flags of byte 0 are not a list"
    );
    expect(create([{ byte: 0, flags: [1, 2] }])).toThrowError(
      "the flags of byte 0 (flags) are not names"
    );
  });
});

describe("Legacy names", () => {
  async function legacyTypes(values: ManufacturerSpecificValue[]) {
    manufacturerSpecificHandlers["TST"] = () => values;
    const legacy = WirelessMbusParser.toLegacyResult(await decode());
    return legacy.dataRecord.slice(1).map((record) => record.type);
  }

  it("A value is named after its description", async () => {
    // the name ends up in the id of an ioBroker object, so every value needs
    // one of its own
    expect(
      await legacyTypes([
        { description: "Warning: smoke alarm", value: 1 },
        { description: "Remaining battery lifetime", value: 83 },
      ])
    ).toEqual(["VIF_WARNING_SMOKE_ALARM", "VIF_REMAINING_BATTERY_LIFETIME"]);
  });

  it("A name of the handler is kept", async () => {
    expect(
      await legacyTypes([
        {
          description: "Battery",
          value: 83,
          legacyName: "VIF_BATTERY_REMAINING",
        },
      ])
    ).toEqual(["VIF_BATTERY_REMAINING"]);
  });

  it("Accents are folded and separators are collapsed", async () => {
    expect(
      await legacyTypes([
        { description: "Füllstand über Grenze", value: 1 },
        { description: "  Tariff 2 - 1/2 h  ", value: 1 },
      ])
    ).toEqual(["VIF_FULLSTAND_UBER_GRENZE", "VIF_TARIFF_2_1_2_H"]);
  });

  it("A description without any letters falls back", async () => {
    expect(await legacyTypes([{ description: "???", value: 1 }])).toEqual([
      "VIF_MANUFACTURER_SPECIFIC",
    ]);
  });
});
