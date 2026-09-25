// The rules a name has to follow, so that the ioBroker adapter can compose a
// state ID from it: snake_case, a digit always follows an underscore
// ("storage_1", never "storage1"), and nothing the adapter adds itself - the
// prefix of the function field and the suffix of the subunit and the tariff.
const NAME = /^[a-z][a-z]*(_([a-z]+|[0-9]+))*$/;
const RESERVED_PREFIX = /^(max|min|error_state)_/;
const RESERVED_SUFFIX = /_[ut]_?[0-9]+$/;

export function isValidName(name: string) {
  return (
    NAME.test(name) &&
    !RESERVED_PREFIX.test(name) &&
    !RESERVED_SUFFIX.test(name)
  );
}

// The name of a value which has none of its own, from its legacy name: e.g.
// VIF_BATTERY_REMAINING becomes battery_remaining.
export function toName(legacyName: string) {
  return legacyName
    .replace(/^VIF_/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/([a-z])([0-9])/g, "$1_$2")
    .replace(/([0-9])([a-z])/g, "$1_$2")
    .replace(/^_+|_+$/g, "");
}
