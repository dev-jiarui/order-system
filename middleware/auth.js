const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  UnauthorizedError,
  ForbiddenError
} = require('../utils/errors');

/**
 * JWT认证中间件
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件函数
 */
const auth = async (req, res, next) => {
  try {
    // 从请求头获取token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedError('未提供认证令牌', 'MISSING_TOKEN');
    }
    
    // 验证token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your-secret-key'
    );
    
    // 查找用户
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new UnauthorizedError('用户不存在', 'USER_NOT_FOUND');
    }
    
    // 将用户信息添加到请求对象
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    // JWT特定错误处理
    if (error.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('无效的认证令牌', 'INVALID_TOKEN', error.message));
    } else if (error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('认证令牌已过期', 'EXPIRED_TOKEN', { expiredAt: error.expiredAt }));
    } else if (!error.isOperational) {
      // 未捕获的非操作错误
      console.error('认证失败:', error);
      next(new UnauthorizedError('认证失败', 'AUTHENTICATION_FAILED'));
    } else {
      next(error);
    }
  }
};

/**
 * 管理员权限验证中间件
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件函数
 */
const adminAuth = (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('未认证用户', 'UNAUTHENTICATED_USER');
    }
    
    if (req.user.role !== 'admin') {
      throw new ForbiddenError(
        '需要管理员权限', 
        'INSUFFICIENT_PERMISSIONS', 
        { requiredRole: 'admin', userRole: req.user.role }
      );
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { auth, adminAuth };