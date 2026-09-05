import { describe, expect, it } from "vitest";

import type { VIFDescriptor, VIFEDescriptor } from "@/types";
import { defaultVIFs } from "@/vif/defaultVifs";
import { fbVifs } from "@/vif/fbVifs";
import { fdVifs } from "@/vif/fdVifs";
import { vifExtensions } from "@/vif/vifExtension";

// The tables are partly generated, so they are written out here in full: the
// snapshot is the readable and searchable list of every VIF the parser knows,
// and any unintended change to a range shows up as a diff.
function listTable(table: VIFDescriptor[]) {
  return table.map((descriptor) => {
    const vif = `0x${descriptor.vif.toString(16).padStart(2, "0")}`;
    // calc(1) is the factor the value is scaled by
    return `${vif} ${descriptor.legacyName} | ${descriptor.description} | ${descriptor.unit} | ${descriptor.apply.name} | x${descriptor.calc(1)}`;
  });
}

function listExtensionTable(table: VIFEDescriptor[]) {
  return table.map((descriptor) => {
    const vif = `0x${descriptor.vif.toString(16).padStart(2, "0")}`;
    const factor =
      descriptor.calc === undefined ? "-" : `x${descriptor.calc(1)}`;
    return `${vif} ${descriptor.legacyName} | ${descriptor.description ?? "-"} | ${descriptor.unit ?? "-"} | ${descriptor.apply.name} | ${factor}`;
  });
}

describe("VIF tables", () => {
  it("Default table", () => {
    expect(listTable(defaultVIFs)).toMatchSnapshot();
  });

  it("FD table", () => {
    expect(listTable(fdVifs)).toMatchSnapshot();
  });

  it("FB table", () => {
    expect(listTable(fbVifs)).toMatchSnapshot();
  });

  it("Extension table", () => {
    expect(listExtensionTable(vifExtensions)).toMatchSnapshot();
  });
});
