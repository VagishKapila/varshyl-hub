function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function sanitize(str) {
  if (!str) return '';
  return str.toString().trim().slice(0, 1000);
}

function parseQueryInt(val, defaultVal = 0, min = 0, max = 999999) {
  const parsed = parseInt(val);
  if (isNaN(parsed)) return defaultVal;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function parseSortField(field, allowed = []) {
  if (!allowed.includes(field)) return null;
  return field;
}

module.exports = {
  isValidEmail,
  sanitize,
  parseQueryInt,
  parseSortField
};
