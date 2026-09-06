import { decodeItronData } from "@/manufacturerSpecificData/itron";
import type { ManufacturerSpecificDataRecordHandler, MeterData } from "@/types";

/**
 * Handlers for manufacturer specific data records, by manufacturer.
 *
 * There is one handler per manufacturer, not per device: manufacturers do not
 * agree on how their devices are told apart. The version field for example is
 * the device version for Techem, but part of the identification number for
 * Itron. A handler decides for itself which meters it can decode, everything
 * it does not recognize yields no values.
 *
 * It is called with the raw bytes of a manufacturer specific data record and
 * returns one entry per value it extracts:
 *
 * ```ts
 * function decodeAcmeData(data: Buffer): ManufacturerSpecificValue[] {
 *   return [
 *     { description: "Backflow detected", value: data[0] & 0x01 },
 *     { description: "Battery", value: data[1], unit: "%" },
 *   ];
 * }
 * ```
 *
 * A blob which is a fixed layout of numbers and flags does not need code at
 * all - see createManufacturerSpecificHandler().
 */
export const manufacturerSpecificHandlers: Record<
  string,
  ManufacturerSpecificDataRecordHandler
> = {
  ITW: decodeItronData,
};

export function getHandler(
  meterData: MeterData,
  configuredHandlers?: Record<string, ManufacturerSpecificDataRecordHandler>
): ManufacturerSpecificDataRecordHandler | null {
  return (
    configuredHandlers?.[meterData.manufacturer] ??
    manufacturerSpecificHandlers[meterData.manufacturer] ??
    null
  );
}
