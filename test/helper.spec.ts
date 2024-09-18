import { describe, expect, it } from "vitest";

import { decodeBCD, decodeManufacturer } from "@/helper/helper";

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
