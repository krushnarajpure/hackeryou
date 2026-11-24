# Font Audit

## Reference inspection

Reference: [Marathi Udyojak](https://marathiudyojak.com/)

The reference article page was inspected in a browser. Its computed article title style was Poppins at approximately 41px, weight 700, and 57.4px line-height. Body text was Poppins at approximately 15px, weight 400, and 26px line-height.

The computed CSS stack identifies Poppins, but the actual font used to render Devanagari glyphs was not verified at the glyph level. Noto Sans Devanagari is a plausible fallback, not a confirmed reference font.

## Local project

The project already imports Poppins and Noto Sans Devanagari and has article-scoped typography styles. Those styles predate this audit pass. No font or application CSS was changed during this audit.

The local article page could not be visually validated in the previous browser check because the API returned HTTP 429. Therefore, local glyph rendering, matras, conjuncts, clipping, and exact font fallback remain unverified.

## Scope and conclusion

- Homepage `/` was not edited during this audit.
- No typography changes were made during this audit.
- Exact Marathi font identity is **unverified**; do not claim font parity.
- The observed Poppins metrics are a reference-page measurement, not a complete site-wide typography inventory.
