module.exports = (value) => String(value || '')
  .normalize('NFKC')
  .toLocaleLowerCase()
  .trim()
  .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '');
