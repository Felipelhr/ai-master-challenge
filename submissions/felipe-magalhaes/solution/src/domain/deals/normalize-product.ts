const PRODUCT_ALIASES: Record<string, string> = { GTXPro: "GTX Pro" };

export function normalizeProduct(name: string): string {
  return PRODUCT_ALIASES[name.trim()] ?? name.trim();
}
