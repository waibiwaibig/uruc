const PIECE_ASSET_URLS = {
  K: new URL('./assets/pieces/traditional/rK.svg', import.meta.url).href,
  A: new URL('./assets/pieces/traditional/rA.svg', import.meta.url).href,
  B: new URL('./assets/pieces/traditional/rB.svg', import.meta.url).href,
  N: new URL('./assets/pieces/traditional/rN.svg', import.meta.url).href,
  R: new URL('./assets/pieces/traditional/rR.svg', import.meta.url).href,
  C: new URL('./assets/pieces/traditional/rC.svg', import.meta.url).href,
  P: new URL('./assets/pieces/traditional/rP.svg', import.meta.url).href,
  k: new URL('./assets/pieces/traditional/bK.svg', import.meta.url).href,
  a: new URL('./assets/pieces/traditional/bA.svg', import.meta.url).href,
  b: new URL('./assets/pieces/traditional/bB.svg', import.meta.url).href,
  n: new URL('./assets/pieces/traditional/bN.svg', import.meta.url).href,
  r: new URL('./assets/pieces/traditional/bR.svg', import.meta.url).href,
  c: new URL('./assets/pieces/traditional/bC.svg', import.meta.url).href,
  p: new URL('./assets/pieces/traditional/bP.svg', import.meta.url).href,
} as const;

export function pieceAssetUrl(piece: string): string | null {
  return PIECE_ASSET_URLS[piece as keyof typeof PIECE_ASSET_URLS] ?? null;
}
