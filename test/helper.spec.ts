import { describe, expect, it } from "vitest";

import {
  decodeBCD,
  decodeDateTimeTypeF,
  decodeDateTimeTypeI,
  decodeDateTypeG,
  decodeDateTypeTechem,
  decodeManufacturer,
  decodeNoYearDateType2Techem,
  decodeNoYearDateTypeTechem,
  encodeDateTypeG,
  getDeviceState,
  guessDeviceId,
} from "@/helper/helper";

describe("decodeBCD", () => {
  it.each([
    { data: [6], digits: 1, expected: 6 },
    { data: [0x13], digits: 2, expected: 13 },
    { data: [0x13, 0x02], digits: 3, expected: 213 },
    { data: [0x13, 0xa2], digits: 4, expected: -213 },
    { data: [0x13, 0xf2], digits: 4, expected: -213 },
  ])("Decode $expected", ({ data, digits, expected }) => {
    const input = Buffer.from(data);
    const result = decodeBCD(digits, input);
    expect(result).toBe(expected);
    expect(Buffer.from(data)).toEqual(input);
  });

  it("Decode 42 with offset", () => {
    const result = decodeBCD(2, Buffer.from("33114299", "hex"), 2);
    expect(result).toBe(42);
  });
});

describe("decodeManufacturer", () => {
  it.each([
    { data: 0x102e, expected: "DAN" },
    { data: 0x2dd8, expected: "KNX" },
    { data: 0x32a7, expected: "LUG" },
    { data: 0x0442, expected: "ABB" },
    { data: 0x1593, expected: "ELS" },
  ])("Decode $expected", ({ data, expected }) => {
    const result = decodeManufacturer(data);
    expect(result).toBe(expected);
  });
});

describe("getDeviceState", () => {
  it.each([
    { data: 0x00, expected: "No error" },
    { data: 0x01, expected: "Busy" },
    { data: 0x04, expected: "No error; low power" },
    { data: 0x06, expected: "Error; low power" },
    { data: 0x08, expected: "No error (permanent)" },
    { data: 0x0b, expected: "Alarm (permanent)" },
    { data: 0x0c, expected: "No error; low power (permanent)" },
    { data: 0x0d, expected: "Busy; low power (permanent)" },
    { data: 0x10, expected: "No error (temporary)" },
    { data: 0x12, expected: "Error (temporary)" },
    { data: 0x14, expected: "No error; low power (temporary)" },
    { data: 0x17, expected: "Alarm; low power (temporary)" },
    { data: 0x18, expected: "No error (permanent) (temporary)" },
    { data: 0xe0, expected: "No error; Manufacturer specific 0b11100000" },
  ])("Device state $expected", ({ data, expected }) => {
    const result = getDeviceState(data);
    expect(result).toBe(expected);
  });
});

describe("decodeDateTypeG", () => {
  it.each([
    { data: 0x1181, expected: "2012-01-01T00:00:00.000Z" },
    { data: 0x18b2, expected: "2013-08-18T00:00:00.000Z" },
    { data: 0x04fe, expected: "2007-04-30T00:00:00.000Z" },
    { data: 0x1c3f, expected: "2009-12-31T00:00:00.000Z" },
  ])("Date $expected", ({ data, expected }) => {
    const result = decodeDateTypeG(data);
    expect(result.toISOString()).toBe(expected);

    const roundTrip = encodeDateTypeG(result);
    expect(roundTrip).toEqual(data);
  });
});

describe("decodeDateTimeTypeF", () => {
  it.each([
    { data: 0x151f3732, expected: "2008-05-31T23:50:00.000Z" },
    { data: 0x25342c03, expected: "2017-05-20T12:03:00.000Z" },
    { data: 0x2a243216, expected: "2017-10-04T18:22:00.000Z" },
    { data: 0x18d90619, expected: "2014-08-25T06:25:00.000Z" },
    { data: 0x28443428, expected: "2018-08-04T20:40:00.000Z" },
  ])("Date $expected", ({ data, expected }) => {
    const result = decodeDateTimeTypeF(data);
    expect(result.toISOString()).toBe(expected);
  });
});

describe("decodeDateTimeTypeI", () => {
  it.each([
    { data: 0x123456123456, expected: "2026-04-22T18:52:22.000Z" },
    { data: 0x21ea4e1138, expected: "2023-01-10T14:17:56.000Z" },
    { data: 0x21e5893826, expected: "2023-01-05T09:56:38.000Z" },
    { data: 0x21e58a0026, expected: "2023-01-05T10:00:38.000Z" },
  ])("Date time $expected", ({ data, expected }) => {
    const result = decodeDateTimeTypeI(data);
    expect(result.toISOString()).toBe(expected);
  });
});

describe("decodeDateTypeTechem", () => {
  it.each([{ data: 0x259f, expected: "2018-12-31T00:00:00.000Z" }])(
    "Date $expected",
    ({ data, expected }) => {
      const result = decodeDateTypeTechem(data);
      expect(result.toISOString()).toBe(expected);
    }
  );
});

describe("decodeDateTypeTechem", () => {
  it.each([
    {
      data: 0x2d90,
      expected: `${new Date().getFullYear()}-06-25T00:00:00.000Z`,
    },
  ])("Date $expected", ({ data, expected }) => {
    const result = decodeNoYearDateTypeTechem(data);
    expect(result.toISOString()).toBe(expected);
  });
});

describe("decodeDateType2Techem", () => {
  it.each([
    {
      dataDay: 0x00,
      dataMonth: 0x60,
      expected: `${new Date().getFullYear()}-11-30T00:00:00.000Z`,
    },
  ])("Date $expected", ({ dataDay, dataMonth, expected }) => {
    const result = decodeNoYearDateType2Techem(dataDay, dataMonth);
    expect(result.toISOString()).toBe(expected);
  });
});

describe("guessDeviceId", () => {
  it.each([
    {
      data: "1234",
      expected: "ERR-XXXXXXXX",
      offset: 0,
    },
    {
      data: "434493157856341233038C2075900F002C25B30A000021924D4F2F",
      expected: "ELS-12345678",
      offset: 0,
    },
    {
      data: "12345678434493157856341233038C2075900F002C25B30A000021924D4F2F",
      expected: "ELS-12345678",
      offset: 4,
    },
  ])("Device ID $expected", ({ data, expected, offset }) => {
    const buf = Buffer.from(data, "hex");
    const id = guessDeviceId(buf, offset);
    expect(id).toBe(expected);
  });
});
