import { describe, expect, it } from "vitest";

import { ParserError } from "@/helper/error";
import { add, divide, multiply } from "@/helper/vifHelper";

describe("multiply", () => {
  it("keeps the type of the value", () => {
    expect(multiply(12.5, 10)).toEqual(125);
    expect(multiply(1234605616436508552n, 10)).toEqual(12346056164365085520n);
  });

  it("throws on other types", () => {
    expect(() => multiply("123", 10)).toThrow(ParserError);
  });
});

describe("add", () => {
  it("keeps the type of the value", () => {
    expect(add(12.5, 10)).toEqual(22.5);
    expect(add(1234605616436508552n, 10)).toEqual(1234605616436508562n);
  });

  it("throws on other types", () => {
    expect(() => add(null, 10)).toThrow(ParserError);
  });
});

describe("divide", () => {
  it("divides numbers", () => {
    expect(divide(1250, 1000)).toEqual(1.25);
  });

  it("converts bigints, since the result is usually not an integer", () => {
    const result = divide(1234605616436508552n, 1000);

    expect(typeof result).toEqual("number");
    expect(result).toEqual(1234605616436508.8);
  });

  it("divides small bigints without loss", () => {
    expect(divide(1250n, 1000)).toEqual(1.25);
  });

  it("throws on other types", () => {
    expect(() => divide(Buffer.alloc(2), 10)).toThrow(ParserError);
  });
});
