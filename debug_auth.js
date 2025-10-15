const jwt = require('jsonwebtoken');

// 解码token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGVmZDBlZWNlMTZmZmEzYzZkMjY0N2YiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2MDU0Nzk4MywiZXhwIjoxNzYwNjM0MzgzfQ.Q-1lEHfcTVFhYQUfVCymbaLqM9-ll31sdjnGXO_U6WA';

try {
  const decoded = jwt.verify(token, 'your-secure-jwt-secret-key-for-development-only-change-in-production');
  console.log('Token decoded:', decoded);
  console.log('User ID from token:', decoded.userId);
  console.log('User ID type:', typeof decoded.userId);
} catch (error) {
  console.error('Token decode error:', error);
}

// 模拟预订用户ID
const reservationUserId = '68efd0eece16ffa3c6d2647f';
const tokenUserId = '68efd0eece16ffa3c6d2647f';

console.log('Reservation user ID:', reservationUserId);
console.log('Token user ID:', tokenUserId);
console.log('String comparison:', reservationUserId === tokenUserId);
console.log('toString comparison:', reservationUserId.toString() === tokenUserId.toString());