import { describe, expect, it } from "vitest";

import {
  calcHeaderCrc,
  decodeDataRecords,
  extractDataRecordHeaders,
} from "@/parser/dataRecords";
import type { DataRecordHeader } from "@/types";

function decode(data: string, headers?: DataRecordHeader[]) {
  return decodeDataRecords(
    {
      data: Buffer.from(data, "hex"),
      pos: 0,
    },
    headers
  );
}

describe("Raw Data Records", () => {
  it("INT8/16/24/32/48/64", () => {
    const result = decode(
      "01fb1b360266d9000313153100046d32371f1506131531123456002f2f8780C04084001A0C000000000000"
    );

    expect(result.dataRecords).toHaveLength(6);

    //humidity INT8
    expect(result.dataRecords[0].value).toEqual(54);
    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 1,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x1b,
          table: 2,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 3,
      offset: 0,
    });

    //temperature INT16
    expect(result.dataRecords[1].value).toEqual(217);
    expect(result.dataRecords[1].header).toEqual({
      dib: {
        dataField: 2,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 102,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 4,
    });

    //volume INT24
    expect(result.dataRecords[2].value).toEqual(12565);
    expect(result.dataRecords[2].header).toEqual({
      dib: {
        dataField: 3,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 19,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 8,
    });

    //Date Type F INT32
    expect(result.dataRecords[3].value).toEqual(0x151f3732);
    expect(result.dataRecords[3].header).toEqual({
      dib: {
        dataField: 0x04,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x6d,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 13,
    });

    //volume INT48
    expect(result.dataRecords[4].value).toEqual(0x5634123115);
    expect(result.dataRecords[4].header).toEqual({
      dib: {
        dataField: 6,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 19,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 19,
    });

    //energy INT64
    expect(result.dataRecords[5].value).toEqual(3098n);
    expect(result.dataRecords[5].header).toEqual({
      dib: {
        dataField: 0x07,
        deviceUnit: 6,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x4,
          table: 0,
          extensionBitSet: true,
        },
        extensions: [0x00],
      },
      length: 6,
      offset: 29,
    });
  });

  it("BCD2/4/6/8/12", () => {
    const result = decode(
      "091345DA023B13012f2f8B60043718020c14270485020e823c513000000000"
    );

    expect(result.dataRecords).toHaveLength(5);

    //volume BCD2
    expect(result.dataRecords[0].value).toEqual(45);
    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0x09,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x13,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 0,
    });

    //volume BCD4
    expect(result.dataRecords[1].value).toEqual(113);
    expect(result.dataRecords[1].header).toEqual({
      dib: {
        dataField: 0x0a,
        deviceUnit: 0,
        functionField: 1,
        storageNo: 5,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 59,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 3,
      offset: 3,
    });

    //energy BCD6
    expect(result.dataRecords[2].value).toEqual(21837);
    expect(result.dataRecords[2].header).toEqual({
      dib: {
        dataField: 0x0b,
        deviceUnit: 1,
        functionField: 0,
        storageNo: 0,
        tariff: 2,
      },
      vib: {
        primary: {
          vif: 4,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 3,
      offset: 10,
    });

    //volume BCD8
    expect(result.dataRecords[3].value).toEqual(2850427);
    expect(result.dataRecords[3].header).toEqual({
      dib: {
        dataField: 0x0c,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 20,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 16,
    });

    //volume BCD12
    expect(result.dataRecords[4].value).toEqual(3051);
    expect(result.dataRecords[4].header).toEqual({
      dib: {
        dataField: 0x0e,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 2,
          table: 0,
          extensionBitSet: true,
        },
        extensions: [0x3c],
      },
      length: 3,
      offset: 22,
    });
  });

  it("Single value - Manufacturer specific - INT16", () => {
    const result = decode("02ff200001");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toEqual(0x100);

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0x02,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x20,
          table: 4,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 3,
      offset: 0,
    });
  });

  it("Single value - Error Flag - INT16", () => {
    const result = decode("02fd170000");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toEqual(0);

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0x02,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 23,
          table: 1,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 3,
      offset: 0,
    });
  });

  it("Single value - Date Type G - INT16", () => {
    const result = decode("426cfe04");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toEqual(0x4fe);

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 2,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 1,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x6c,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 0,
    });
  });

  it("Single value - Energy - FLOAT32", () => {
    const result = decode("057c096369746568746e79536cb22942");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toBeCloseTo(42.42424);

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0x05,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x7c,
          table: 3,
          plainText: "Synthetic",
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 12,
      offset: 0,
    });
  });
});

describe("Raw Data Records - LVAR", () => {
  it("Single value - Version - String", () => {
    const result = decode("0dfd0c0434474b42");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toEqual("BKG4");

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0x0d,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0xc,
          table: 1,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 3,
      offset: 0,
    });
  });

  it("Single value - Energy - BCD", () => {
    const result = decode("0d13c512345678902f");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toEqual(9078563412);

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0x0d,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x13,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 0,
    });
  });

  it("Single value - Energy - negative BCD", () => {
    const result = decode("0d13d51234567890");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toEqual(-9078563412);

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0x0d,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x13,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 0,
    });
  });

  it("Single value - Time offset - Binary number", () => {
    const result = decode("cd016de20330");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toEqual(0x3003);

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0x0d,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 3,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x6d,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 3,
      offset: 0,
    });
  });

  it("Single value - Time offset - Binary number (large)", () => {
    const result = decode("cd016de803301234567890");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toEqual("03301234567890");

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0x0d,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 3,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x6d,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 3,
      offset: 0,
    });
  });

  it("Single value - Volume - Double", () => {
    const result = decode("0d13f879cbd58f4d364540");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toBeCloseTo(42.424242);

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0x0d,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 19,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 0,
    });
  });
});

describe("Special DIF values", () => {
  it("DIF_NONE", () => {
    const result = decode("0013ff");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toEqual(null);

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 0,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x13,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 0,
    });
  });

  it("DIF_READOUT", () => {
    const result = decode("0813ff");

    expect(result.dataRecords).toHaveLength(1);
    expect(result.dataRecords[0].value).toEqual(null);

    expect(result.dataRecords[0].header).toEqual({
      dib: {
        dataField: 8,
        deviceUnit: 0,
        functionField: 0,
        storageNo: 0,
        tariff: 0,
      },
      vib: {
        primary: {
          vif: 0x13,
          table: 0,
          extensionBitSet: false,
        },
        extensions: [],
      },
      length: 2,
      offset: 0,
    });
  });

  it("DIF_SPECIAL_FUNCTION", () => {
    expect(() => decode("0f123456")).toThrow(
      "DIF for special function at 1 - remaining data: 123456"
    );
  });
});

describe("Compact frames", () => {
  it("Calc Header CRC", () => {
    const dr =
      "0406A60B000004FF074E11000004FF08130700000414C91A000002FD170000043B000000000259B10B025D6709";
    const result = decode(dr);

    expect(result.dataRecords).toHaveLength(8);

    const crc = calcHeaderCrc(result.dataRecords, Buffer.from(dr, "hex"));
    expect(crc).toEqual(0xd7c4);
  });

  it("Decode with cache", () => {
    const fullFrameResult = decode(
      "0406A60B000004FF074E11000004FF08130700000414C91A000002FD170000043B000000000259B10B025D6709"
    );
    const headers = extractDataRecordHeaders(fullFrameResult.dataRecords);
    const compactFrameResult = decode(
      "A60B00004E11000013070000C91A0000000000000000B10B6709",
      headers
    );

    expect(fullFrameResult.dataRecords).toEqual(compactFrameResult.dataRecords);
  });
});
