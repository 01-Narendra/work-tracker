/**
 * Sanitizes input to prevent MongoDB operator injection ($gt, $where, etc.)
 * by stripping keys starting with '$' or containing '.' from body, query, and params.
 */
export function sanitizeMongoInput(req, _res, next) {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (typeof obj[i] === 'object') sanitize(obj[i]);
      }
      return obj;
    }
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
}

export default sanitizeMongoInput;

