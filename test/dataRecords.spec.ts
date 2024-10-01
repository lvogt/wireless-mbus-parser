import { describe, expect, it } from "vitest";

import { decodeDataRecords } from "@/parser/dataRecords";

function decode(data: string) {
  return decodeDataRecords({
    data: Buffer.from(data, "hex"),
    pos: 0,
  });
}

describe("Raw Data Records", () => {
  it("Single value - Humidity - INT8", () => {
    const result = decode("01fb1b36");

    expect(result.dataRecords).to.have.lengthOf(1);
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
  });

  it("Single value - Temperature - INT16", () => {
    const result = decode("0266d900");

    expect(result.dataRecords).to.have.lengthOf(1);
    expect(result.dataRecords[0].value).toEqual(217);

    expect(result.dataRecords[0].header).toEqual({
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
      offset: 0,
    });
  });

  it("Single value - Manufacturer specific - INT16", () => {
    const result = decode("02ff200001");

    expect(result.dataRecords).to.have.lengthOf(1);
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

    expect(result.dataRecords).to.have.lengthOf(1);
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

    expect(result.dataRecords).to.have.lengthOf(1);
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

  it("Single value - Volume - INT24", () => {
    const result = decode("0313153100");

    expect(result.dataRecords).to.have.lengthOf(1);
    expect(result.dataRecords[0].value).toEqual(12565);

    expect(result.dataRecords[0].header).toEqual({
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
      offset: 0,
    });
  });

  it("Single value - Date Type F - INT32", () => {
    const result = decode("046d32371f15");

    expect(result.dataRecords).to.have.lengthOf(1);
    expect(result.dataRecords[0].value).toEqual(0x151f3732);

    expect(result.dataRecords[0].header).toEqual({
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
      offset: 0,
    });
  });

  it("Single value - Volume - INT48", () => {
    const result = decode("0613153112345600");

    expect(result.dataRecords).to.have.lengthOf(1);
    expect(result.dataRecords[0].value).toEqual(0x5634123115);

    expect(result.dataRecords[0].header).toEqual({
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
      offset: 0,
    });
  });

  it("Single value - Energy - INT64", () => {
    const result = decode("2f2f8780C04084001A0C000000000000");

    expect(result.dataRecords).to.have.lengthOf(1);
    expect(result.dataRecords[0].value).toEqual(3098n);

    expect(result.dataRecords[0].header).toEqual({
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
      offset: 2,
    });
  });

  it("Single value - Energy - FLOAT32", () => {
    const result = decode("057c096369746568746e79536cb22942");

    expect(result.dataRecords).to.have.lengthOf(1);
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

  it("Single value - Volume - BCD2", () => {
    const result = decode("091345");

    expect(result.dataRecords).to.have.lengthOf(1);
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
  });

  it("Single value - Volume flow - BCD4", () => {
    const result = decode("DA023B13012f2f");

    expect(result.dataRecords).to.have.lengthOf(1);
    expect(result.dataRecords[0].value).toEqual(113);

    expect(result.dataRecords[0].header).toEqual({
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
      offset: 0,
    });
  });

  it("Single value - Energy - BCD6", () => {
    const result = decode("8B6004371802");

    expect(result.dataRecords).to.have.lengthOf(1);
    expect(result.dataRecords[0].value).toEqual(21837);

    expect(result.dataRecords[0].header).toEqual({
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
      offset: 0,
    });
  });

  it("Single value - Volume - BCD8", () => {
    const result = decode("0c1427048502");

    expect(result.dataRecords).to.have.lengthOf(1);
    expect(result.dataRecords[0].value).toEqual(2850427);

    expect(result.dataRecords[0].header).toEqual({
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
      offset: 0,
    });
  });

  it("Single value - Volume - BCD12", () => {
    const result = decode("0e823c513000000000");

    expect(result.dataRecords).to.have.lengthOf(1);
    expect(result.dataRecords[0].value).toEqual(3051);

    expect(result.dataRecords[0].header).toEqual({
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
      offset: 0,
    });
  });
});

describe("Raw Data Records - LVAR", () => {
  it("Single value - Version - String", () => {
    const result = decode("0dfd0c0434474b42");

    expect(result.dataRecords).to.have.lengthOf(1);
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
    const result = decode("0d13c51234567890");

    expect(result.dataRecords).to.have.lengthOf(1);
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

    expect(result.dataRecords).to.have.lengthOf(1);
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

    expect(result.dataRecords).to.have.lengthOf(1);
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

    expect(result.dataRecords).to.have.lengthOf(1);
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

    expect(result.dataRecords).to.have.lengthOf(1);
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

    expect(result.dataRecords).to.have.lengthOf(1);
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

    expect(result.dataRecords).to.have.lengthOf(1);
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
