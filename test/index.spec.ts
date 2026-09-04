import { describe, expect, it } from "vitest";

import { ParserError, WirelessMbusParser } from "@/index";

describe("Public API", () => {
  it("exports ParserError as a value, so it can be used with instanceof", async () => {
    const parser = new WirelessMbusParser();

    await expect(
      parser.parse(Buffer.from("1444AE0C7856341201078C2027780B1343", "hex"))
    ).rejects.toBeInstanceOf(ParserError);
  });
});
