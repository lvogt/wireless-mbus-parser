import { applyNumberDefault, divide, multiply } from "@/helper/vifHelper";
import type { DataType, VIFDescriptor } from "@/types";

function scaleBy(exponent: number) {
  if (exponent === 0) {
    return (value: DataType) => value;
  }

  const factor = 10 ** Math.abs(exponent);
  return exponent > 0
    ? (value: DataType) => multiply(value, factor)
    : (value: DataType) => divide(value, factor);
}

// Most VIFs come in ranges which only differ in the power of ten the value has
// to be scaled by: the least significant bits of the VIF are the exponent. The
// resulting descriptors are the same as written out ones - the lookup stays a
// plain table without any branching.
export function decadeRange(
  vif: number,
  count: number,
  exponent: number,
  legacyName: string,
  unit: string,
  description: string
): VIFDescriptor[] {
  return Array.from({ length: count }, (_, index) => ({
    vif: vif + index,
    legacyName,
    unit,
    description,
    calc: scaleBy(exponent + index),
    apply: applyNumberDefault,
  }));
}
