const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

export function checkedMinor(value: bigint): number {
  if (value > MAX_MINOR || value < -MAX_MINOR) {
    throw new Error("Amount exceeds the safe money limit.");
  }
  return Number(value);
}

/** Accept a decimal pounds input without silently treating an empty field as zero. */
export function parseMoney(input: string): number {
  const text = input.trim();
  if (
    text.length > 80 ||
    !/^[+-]?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text)
  ) {
    throw new Error("Enter an amount with at most two decimal places.");
  }
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace(/^[+-]/, "").split(".");
  const value =
    BigInt(whole || "0") * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return checkedMinor(negative ? -value : value);
}

/** Format the integer directly so large, safe amounts do not lose a penny. */
export function formatMinor(value: number): string {
  if (!Number.isSafeInteger(value))
    throw new Error("Money must be safe integer pence.");
  const minor = BigInt(value < 0 ? -value : value);
  const pounds = (minor / BigInt(100))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0 ? "-" : ""}£${pounds}.${(minor % BigInt(100)).toString().padStart(2, "0")}`;
}
