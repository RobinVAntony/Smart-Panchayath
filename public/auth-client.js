const API_BASE = 'http://localhost:8181/api';

async function authFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/public/login.html';
    return null;
  }

  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',   // ✅ REQUIRED
      Authorization: `Bearer ${token}`
    }
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('token');
    window.location.href = '/public/login.html';
    return null;
  }

  return res;
}
