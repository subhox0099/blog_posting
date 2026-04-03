function isStrongPassword(pw) {
  if (typeof pw !== 'string') return false;
  const s = pw.trim();
  if (s.length < 8) return false;
  const hasLetter = /[A-Za-z]/.test(s);
  const hasNumber = /\d/.test(s);
  const hasSymbol = /[^A-Za-z0-9]/.test(s);
  return hasLetter && hasNumber && hasSymbol;
}

module.exports = { isStrongPassword };

