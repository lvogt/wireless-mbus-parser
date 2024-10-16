import { describe, expect, it } from "vitest";

import {
  decodeExtendedLinkLayer,
  hasExtendedLinkLayer,
} from "@/parser/extendedLinkLayer";
import { decodeLinkLayer } from "@/parser/linkLayer";
import type { LinkLayer } from "@/types";

function decode(data: string | Buffer, key?: string) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "hex");

  const result = decodeLinkLayer({
    data: buf,
    pos: 0,
  });

  return decodeExtendedLinkLayer(
    {
      data: buf,
      pos: 10,
      key: key ? Buffer.from(key, "hex") : undefined,
    },
    result.linkLayer as LinkLayer
  );
}

describe("Extended Link Layer", () => {
  it("CI does not match", () => {
    const result = hasExtendedLinkLayer({
      data: Buffer.alloc(12),
      pos: 0,
    });

    expect(result).toBe(false);
  });

  it("Check fields - CI ELL_2", () => {
    const result = decode("1444AE0C7856341201078C2027780B13436587");

    expect(result.extendedLinkLayer).toEqual({
      ci: 0x8c,
      communicationControl: 32,
      accessNumber: 39,
    });
  });

  it("Check fields - CI ELL_10", () => {
    const result = decode(
      "530824484433221103378e80753a63665544330a31900f002c25b30a0000af5d74df73a600d972785634129315330375002007109058475f4bc91df878b80a1b0f98b629024aac727942bfc549233c0140829b93"
    );

    expect(result.extendedLinkLayer).toEqual({
      ci: 0x8e,
      communicationControl: 128,
      accessNumber: 117,
      manufacturer: 25402,
      address: Buffer.from("665544330A31", "hex"),
    });
  });

  it("Encrypted but no key", () => {
    expect(() =>
      decode(
        "24442D2C692845631B168D3050209CD621B006B1140AEF4953AE5B86FAFC0B00E70705B846"
      )
    ).toThrowErrorMatchingInlineSnapshot(
      "[NO_AES_KEY: Encrytped ELL, but no key provided!]"
    );
  });

  it("No enc flag", () => {
    const result = decode(
      "24442D2C692845631B168D3050209CD601B006B1140AEF4953AE5B86FAFC0B00E70705B846",
      "4E5508544202058100DFEFA06B0934A5"
    );

    expect(result.extendedLinkLayer).toEqual({
      ci: 0x8d,
      communicationControl: 48,
      accessNumber: 80,
      sessionNumber: 30841888,
      session: {
        enc: 0,
        time: 1927618,
        session: 0,
      },
    });
  });

  it("Decrypt CI ELL_8", () => {
    const result = decode(
      "24442D2C692845631B168D3050209CD621B006B1140AEF4953AE5B86FAFC0B00E70705B846",
      "4E5508544202058100DFEFA06B0934A5"
    );

    expect(result.extendedLinkLayer).toEqual({
      ci: 0x8d,
      communicationControl: 48,
      accessNumber: 80,
      sessionNumber: 567712800,
      session: {
        enc: 1,
        time: 1927618,
        session: 0,
      },
    });
  });

  // Beware: Synthetic telegram data
  it("Decrypt CI ELL_16", () => {
    const result = decode(
      "2C442D2C692845631B168F30502d2c692845631b16209CD621B006B1140AEF4953AE5B86FAFC0B00E70705B846",
      "4E5508544202058100DFEFA06B0934A5"
    );

    expect(result.extendedLinkLayer).toEqual({
      ci: 0x8f,
      communicationControl: 48,
      manufacturer: 11309,
      address: Buffer.from("692845631b16", "hex"),
      accessNumber: 80,
      sessionNumber: 567712800,
      session: {
        enc: 1,
        time: 1927618,
        session: 0,
      },
    });
  });

  it("Decryption with wrong key", () => {
    expect(() =>
      decode(
        "24442D2C692845631B168D3050209CD621B006B1140AEF4953AE5B86FAFC0B00E70705B846",
        "4E1108544202058100DFEFA06B0934A5"
      )
    ).toThrowErrorMatchingInlineSnapshot(
      "[WRONG_AES_KEY: Payload CRC check failed on ExtendedLinkLayer, wrong AES key?]"
    );
  });

  it("ELL Encryption - already decrypted", () => {
    const result = decode(
      "3F442D2C06357260190C8D207C71032F21255C79DD829283011117650000BFA80000D24F0000B1FB00000000E919FF18F7640000E8FA00000B000000DB111C0B"
    );

    expect(result.extendedLinkLayer).toEqual({
      ci: 0x8d,
      communicationControl: 32,
      accessNumber: 124,
      sessionNumber: 556729201,
      session: {
        enc: 1,
        time: 1241143,
        session: 1,
      },
    });
  });
});
