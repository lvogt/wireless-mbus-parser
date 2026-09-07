import type {
  DataRecord,
  ManufacturerSpecificDataRecordHandler,
  ManufacturerSpecificFieldSpec,
  ManufacturerSpecificFlagsSpec,
  ManufacturerSpecificLayout,
  ManufacturerSpecificValue,
  ManufacturerSpecificValueSpec,
  MeterData,
} from "@/types";

// Buffer.readUIntLE reads at most 6 bytes, which is the point where a value no
// longer fits into a JS number without losing precision anyway.
const MAX_FIELD_BYTES = 6;

function fail(message: string): never {
  throw new Error(`Invalid manufacturer specific field spec: ${message}`);
}

function describe(spec: ManufacturerSpecificFieldSpec) {
  return `byte ${String(spec.byte)} (${spec.description ?? "flags"})`;
}

function isFlagsSpec(
  spec: ManufacturerSpecificFieldSpec
): spec is ManufacturerSpecificFlagsSpec {
  return spec.flags !== undefined;
}

function isLayout(
  entry: ManufacturerSpecificFieldSpec | ManufacturerSpecificLayout
): entry is ManufacturerSpecificLayout {
  return "fields" in entry;
}

function width(spec: ManufacturerSpecificFieldSpec) {
  return spec.bytes ?? 1;
}

// The blob has to hold every field of a layout for it to describe it - a
// shorter one belongs to a device or a firmware the layout does not know.
function requiredLength(fields: ManufacturerSpecificFieldSpec[]) {
  return fields.reduce((length, spec) => {
    return Math.max(length, spec.byte + width(spec));
  }, 0);
}

function checkBit(spec: ManufacturerSpecificFieldSpec, bit: unknown) {
  if (
    !Number.isInteger(bit) ||
    (bit as number) < 0 ||
    (bit as number) >= width(spec) * 8
  ) {
    fail(`bit ${String(bit)} is outside of the field at ${describe(spec)}`);
  }
}

function checkValueSpec(spec: ManufacturerSpecificValueSpec) {
  if (typeof spec.description !== "string" || spec.description === "") {
    fail(`the field at byte ${String(spec.byte)} has no description`);
  }
  if (spec.bit !== undefined && spec.bits !== undefined) {
    fail(`${describe(spec)} states both a bit and a bit range`);
  }
  if (spec.bit !== undefined) {
    checkBit(spec, spec.bit);
  }
  if (spec.bits !== undefined) {
    if (!Array.isArray(spec.bits) || spec.bits.length !== 2) {
      fail(`the bit range of ${describe(spec)} is not a pair of bits`);
    }
    checkBit(spec, spec.bits[0]);
    checkBit(spec, spec.bits[1]);
    if (spec.bits[0] > spec.bits[1]) {
      fail(`the bit range of ${describe(spec)} ends before it starts`);
    }
  }
  if (
    spec.values !== undefined &&
    (typeof spec.values !== "object" ||
      Object.values(spec.values).some((name) => typeof name !== "string"))
  ) {
    fail(`the value names of ${describe(spec)} are not strings`);
  }
}

function checkFlagsSpec(spec: ManufacturerSpecificFlagsSpec) {
  if (!Array.isArray(spec.flags)) {
    fail(`the flags of byte ${String(spec.byte)} are not a list`);
  }
  if (spec.flags.length > width(spec) * 8) {
    fail(`there are more flags than bits at ${describe(spec)}`);
  }
  if (spec.flags.some((name) => name !== null && typeof name !== "string")) {
    fail(`the flags of ${describe(spec)} are not names`);
  }
}

function checkFieldSpec(spec: ManufacturerSpecificFieldSpec) {
  if (!Number.isInteger(spec.byte) || spec.byte < 0) {
    fail(`${String(spec.byte)} is not a byte offset`);
  }
  if (
    spec.bytes !== undefined &&
    (!Number.isInteger(spec.bytes) ||
      spec.bytes < 1 ||
      spec.bytes > MAX_FIELD_BYTES)
  ) {
    fail(
      `the field at byte ${String(spec.byte)} is not 1 to ${String(MAX_FIELD_BYTES)} bytes wide`
    );
  }

  if (isFlagsSpec(spec)) {
    if (spec.description !== undefined) {
      fail(`${describe(spec)} states both flags and a description`);
    }
    checkFlagsSpec(spec);
  } else {
    checkValueSpec(spec);
  }
}

// A layout which states a condition no telegram can meet would silently never
// decode anything, which is the worst thing a description read from a
// configuration file can do.
function checkCondition(value: unknown, what: string) {
  if (!Number.isInteger(value) || (value as number) < 0) {
    fail(`the ${what} of a layout is not a number: ${String(value)}`);
  }
}

function checkLayout(layout: ManufacturerSpecificLayout) {
  if (layout.deviceType !== undefined) {
    const types = Array.isArray(layout.deviceType)
      ? layout.deviceType
      : [layout.deviceType];
    for (const type of types) {
      checkCondition(type, "device type");
    }
  }
  for (const [what, value] of [
    ["VIF", layout.vif],
    ["length", layout.length],
    ["index", layout.index],
  ] as const) {
    if (value !== undefined) {
      checkCondition(value, what);
    }
  }
}

// Bit fields are cut out by dividing instead of shifting, so that a field
// beyond the 32 bit of the bitwise operators works as well.
function extract(value: number, offset: number, bits: number) {
  return Math.floor(value / 2 ** offset) % 2 ** bits;
}

function baseValue(spec: ManufacturerSpecificFieldSpec) {
  return {
    unit: spec.unit,
    legacyName: spec.legacyName,
    storageNo: spec.storageNo,
    tariff: spec.tariff,
  };
}

function decodeValue(
  raw: number,
  spec: ManufacturerSpecificValueSpec
): ManufacturerSpecificValue {
  let value: number;
  if (spec.bit !== undefined) {
    value = extract(raw, spec.bit, 1);
  } else if (spec.bits !== undefined) {
    value = extract(raw, spec.bits[0], spec.bits[1] - spec.bits[0] + 1);
  } else {
    value = raw;
  }

  return {
    ...baseValue(spec),
    description: spec.description,
    // a list names the values 0, 1, 2 and so on, an object only the ones which
    // have a name - both are indexed the same way
    value: spec.values?.[value] ?? value,
  };
}

function decodeFlags(
  raw: number,
  spec: ManufacturerSpecificFlagsSpec
): ManufacturerSpecificValue[] {
  return spec.flags.flatMap((description, bit) =>
    description === null
      ? []
      : [{ ...baseValue(spec), description, value: extract(raw, bit, 1) }]
  );
}

function decodeFields(
  data: Buffer,
  fields: ManufacturerSpecificFieldSpec[]
): ManufacturerSpecificValue[] {
  return fields.flatMap((spec) => {
    const raw = data.readUIntLE(spec.byte, width(spec));
    return isFlagsSpec(spec)
      ? decodeFlags(raw, spec)
      : [decodeValue(raw, spec)];
  });
}

interface Layout {
  layout: ManufacturerSpecificLayout;
  // the length the fields of the layout need, so it is only computed once
  minLength: number;
}

function matches(
  { layout, minLength }: Layout,
  data: Buffer,
  meterData: MeterData,
  dataRecord: DataRecord,
  index: number
) {
  if (layout.deviceType !== undefined) {
    const types = Array.isArray(layout.deviceType)
      ? layout.deviceType
      : [layout.deviceType];
    if (!types.includes(meterData.type)) {
      return false;
    }
  }

  if (
    layout.vif !== undefined &&
    layout.vif !== dataRecord.header.vib.primary.vif
  ) {
    return false;
  }

  if (layout.length !== undefined && layout.length !== data.length) {
    return false;
  }

  if (layout.index !== undefined && layout.index !== index) {
    return false;
  }

  // a blob which does not hold all the fields is not the one the layout
  // describes, so the next layout gets its turn
  return data.length >= minLength;
}

/**
 * Creates a handler for manufacturer specific data records from a description
 * of the values a blob holds - so a meter can be decoded without writing any
 * code, e.g. from a configuration file:
 *
 * ```ts
 * const decodeAcmeData = createManufacturerSpecificHandler([
 *   { byte: 0, bit: 0, description: "Backflow detected" },
 *   { byte: 1, description: "Battery", unit: "%" },
 *   { byte: 2, bytes: 3, description: "Volume", unit: "l" },
 *   { byte: 5, flags: ["Leakage", "Burst", null, "Removal"] },
 * ]);
 * ```
 *
 * Pass a list of layouts instead to describe several kinds of blob, each with
 * the device types and the VIF it belongs to. The first layout which matches
 * decodes the blob, one without conditions matches everything:
 *
 * ```ts
 * const decodeAcmeData = createManufacturerSpecificHandler([
 *   { deviceType: 0x07, fields: [...] },
 *   { deviceType: [0x04, 0x0c], fields: [...] },
 * ]);
 * ```
 *
 * A blob which is too short for all the fields of its layout yields no values,
 * as does one no layout matches.
 *
 * @throws if the description itself is not sound, e.g. a bit outside of its
 * field - that is a mistake of its author, not of a telegram.
 */
export function createManufacturerSpecificHandler(
  spec: ManufacturerSpecificFieldSpec[] | ManufacturerSpecificLayout[]
): ManufacturerSpecificDataRecordHandler {
  if (!Array.isArray(spec)) {
    fail("expected a list of fields or layouts");
  }

  const layoutCount = spec.filter((entry) => isLayout(entry)).length;
  if (layoutCount !== 0 && layoutCount !== spec.length) {
    fail("fields and layouts cannot be mixed in one list");
  }

  const layouts: ManufacturerSpecificLayout[] =
    layoutCount === spec.length && spec.length !== 0
      ? (spec as ManufacturerSpecificLayout[])
      : [{ fields: spec as ManufacturerSpecificFieldSpec[] }];

  for (const layout of layouts) {
    checkLayout(layout);
    for (const field of layout.fields) {
      checkFieldSpec(field);
    }
  }

  const known: Layout[] = layouts.map((layout) => ({
    layout,
    minLength: requiredLength(layout.fields),
  }));

  return (data, meterData, dataRecord, index) => {
    const match = known.find((entry) =>
      matches(entry, data, meterData, dataRecord, index)
    );

    return match === undefined ? [] : decodeFields(data, match.layout.fields);
  };
}
