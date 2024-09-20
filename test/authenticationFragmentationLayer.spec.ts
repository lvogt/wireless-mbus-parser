import { describe, expect, it } from "vitest";

import {
  decodeAuthenticationAndFragmentationLayer,
  hasAuthenticationAndFragmentationLayer,
} from "@/parser/authenticationFragmentationLayer";

describe("Authentication and Fragmentation Layer", () => {
  it("CI does not match", () => {
    const result = hasAuthenticationAndFragmentationLayer({
      data: Buffer.alloc(12),
      pos: 0,
    });

    expect(result).toBe(false);
  });

  it("Check fields", () => {
    const result = decodeAuthenticationAndFragmentationLayer({
      data: Buffer.from("900F002C25B30A000021924D4F2FB66E01", "hex"),
      pos: 0,
    });

    expect(result.authenticationAndFragmentationLayer).toEqual({
      ci: 0x90,
      afll: 0x0f,
      fclRaw: 0x2c00,
      fcl: {
        mf: false,
        mclp: true,
        mlp: false,
        mcrp: true,
        macp: true,
        kip: false,
        fid: 0,
      },
      mclRaw: 0x25,
      mcl: {
        mlmp: false,
        mcmp: true,
        kimp: false,
        at: 5,
      },
      mcr: 0x00000ab3,
      mac: Buffer.from("21924D4F2FB66E01", "hex"),
    });
  });
});
