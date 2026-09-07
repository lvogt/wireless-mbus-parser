import { describe, expect, it } from "vitest";

import { ParserError, toParserError } from "@/helper/error";

describe("toParserError", () => {
  it("A ParserError is passed through", () => {
    const error = new ParserError("CRC_ERROR", "CRC check failed");

    expect(toParserError(error)).toBe(error);
  });

  it("An error is wrapped, keeping the original as cause", () => {
    // reading beyond the end of a telegram surfaces as a RangeError
    const error = new RangeError("Attempt to access memory outside buffer");
    const parserError = toParserError(error);

    expect(parserError).toBeInstanceOf(ParserError);
    expect(parserError.name).toEqual("UNEXPECTED_STATE");
    expect(parserError.message).toEqual(
      "Failed to parse telegram: Attempt to access memory outside buffer"
    );
    expect(parserError.cause).toBe(error);
  });

  it("Something which is not an error at all is wrapped as well", () => {
    const parserError = toParserError("just a string");

    expect(parserError.message).toEqual(
      "Failed to parse telegram: just a string"
    );
    expect(parserError.cause).toEqual("just a string");
  });
});
