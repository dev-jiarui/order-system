const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * 创建GraphQL上下文
 * 从请求中提取用户信息并添加到上下文中
 */
const createContext = async ({ req }) => {
  let user = null;
  let authError = null;
  
  try {
    // 从请求头获取token
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      // 验证token
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'your-secret-key'
      );
      
      // 查找用户
      user = await User.findById(decoded.userId);
      
      if (!user) {
        authError = {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        };
      }
    }
  } catch (error) {
    // Token验证失败，设置具体的错误信息
    console.warn('GraphQL认证失败:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      authError = {
        code: 'TOKEN_EXPIRED',
        message: 'JWT已过期，请重新登录'
      };
    } else if (error.name === 'JsonWebTokenError') {
      authError = {
        code: 'TOKEN_INVALID',
        message: 'JWT无效，请重新登录'
      };
    } else {
      authError = {
        code: 'AUTH_ERROR',
        message: '认证失败'
      };
    }
  }
  
  return {
    user,
    authError,
    req
  };
};

module.exports = { createContext };