import { describe, expect, it } from "vitest";

import { isValidName } from "@/helper/name";
import type { VIFDescriptor, VIFEDescriptor } from "@/types";
import { defaultVIFs } from "@/vif/defaultVifs";
import { fbVifs } from "@/vif/fbVifs";
import { fdVifs } from "@/vif/fdVifs";
import {
  manufacturerSpecificsVifes,
  manufacturerSpecificsVifs,
} from "@/vif/manufacturerSpecificVifs";
import { vifExtensions } from "@/vif/vifExtension";

// The tables are partly generated, so they are written out here in full: the
// snapshot is the readable and searchable list of every VIF the parser knows,
// and any unintended change to a range shows up as a diff. That includes the
// names, which are public API - changing one is a breaking change.
function listTable(table: VIFDescriptor[]) {
  return table.map((descriptor) => {
    const vif = `0x${descriptor.vif.toString(16).padStart(2, "0")}`;
    // calc(1) is the factor the value is scaled by
    return `${vif} ${descriptor.legacyName} ${descriptor.name} | ${descriptor.description} | ${descriptor.unit} | ${descriptor.apply.name} | x${descriptor.calc(1)}`;
  });
}

function listExtensionTable(table: VIFEDescriptor[]) {
  return table.map((descriptor) => {
    const vif = `0x${descriptor.vif.toString(16).padStart(2, "0")}`;
    const factor =
      descriptor.calc === undefined ? "-" : `x${descriptor.calc(1)}`;
    return `${vif} ${descriptor.legacyName} ${descriptor.name ?? "-"} | ${descriptor.description ?? "-"} | ${descriptor.unit ?? "-"} | ${descriptor.apply.name} | ${factor} | ${descriptor.error ?? "-"}`;
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

  it("Manufacturer specific tables", () => {
    for (const [manufacturer, table] of Object.entries(
      manufacturerSpecificsVifs
    )) {
      expect(listTable(table)).toMatchSnapshot(manufacturer);
    }
    for (const [manufacturer, table] of Object.entries(
      manufacturerSpecificsVifes
    )) {
      expect(listExtensionTable(table)).toMatchSnapshot(manufacturer);
    }
  });
});

describe("Names", () => {
  const vifs = [
    ...defaultVIFs,
    ...fdVifs,
    ...fbVifs,
    ...Object.values(manufacturerSpecificsVifs).flat(),
  ];
  const vifes = [
    ...vifExtensions,
    ...Object.values(manufacturerSpecificsVifes).flat(),
  ];

  it.each(vifs.map((descriptor) => [descriptor.legacyName, descriptor.name]))(
    "%s: %s follows the naming rules",
    (_legacyName, name) => {
      expect(isValidName(name)).toBe(true);
    }
  );

  it.each(
    vifes
      .filter((descriptor) => descriptor.name !== undefined)
      .map((descriptor) => [descriptor.legacyName, descriptor.name])
  )("%s: %s follows the naming rules", (_legacyName, name) => {
    expect(isValidName(name as string)).toBe(true);
  });

  // the same quantity in another unit has the same name, a different quantity
  // never does
  it("One name per legacy name", () => {
    const names = new Map<string, Set<string>>();
    for (const descriptor of [...vifs, ...vifes]) {
      if (descriptor.name === undefined) {
        continue;
      }
      const table = names.get(descriptor.legacyName) ?? new Set();
      names.set(descriptor.legacyName, table.add(descriptor.name));
    }
    const ambiguous = [...names].filter(([, set]) => set.size > 1);
    expect(ambiguous).toEqual([]);
  });

  it.each(
    vifExtensions
      .filter((descriptor) => descriptor.error !== undefined)
      .map((descriptor) => [descriptor.legacyName, descriptor.error])
  )("%s: error %s follows the naming rules", (_legacyName, error) => {
    expect(isValidName(error as string)).toBe(true);
  });

  // a record error leaves the value in the state of its quantity, so it has no
  // name but is reported as an error - except "no error" and "standard conform"
  it("Only extensions below 0x20 report an error, and none has a name", () => {
    const below = vifExtensions.filter((descriptor) => descriptor.vif < 0x20);
    const errors = below.filter((descriptor) => descriptor.error !== undefined);

    expect(below.filter((descriptor) => descriptor.name !== undefined)).toEqual(
      []
    );
    expect(
      below
        .filter((descriptor) => descriptor.error === undefined)
        .map((descriptor) => descriptor.vif)
    ).toEqual([0x00, 0x1d]);
    expect(
      vifExtensions.filter(
        (descriptor) => descriptor.vif >= 0x20 && descriptor.error !== undefined
      )
    ).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("Above 0x1f, only extensions which scale the value have no name", () => {
    const unnamed = vifExtensions
      .filter(
        (descriptor) => descriptor.vif >= 0x20 && descriptor.name === undefined
      )
      .map((descriptor) => descriptor.vif);
    const scaling = vifExtensions
      .filter((descriptor) => descriptor.calc !== undefined)
      .map((descriptor) => descriptor.vif);

    expect(unnamed).toEqual([...scaling, 0x7f]);
  });
});
