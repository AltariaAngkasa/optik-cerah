const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-jangan-dipakai-produksi';
const COOKIE_NAME = 'oc_token';

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function getTokenFromReq(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) return res.status(401).json({ error: 'Kamu harus login dulu.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesi login tidak valid, silakan login ulang.' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Akses ditolak. Khusus admin.' });
    }
    next();
  });
}

// Optional auth: attaches req.user if token valid, but doesn't block
function optionalAuth(req, res, next) {
  const token = getTokenFromReq(req);
  if (token) {
    try { req.user = jwt.verify(token, SECRET); } catch (e) { /* ignore */ }
  }
  next();
}

module.exports = { signToken, setAuthCookie, clearAuthCookie, requireAuth, requireAdmin, optionalAuth, COOKIE_NAME };
