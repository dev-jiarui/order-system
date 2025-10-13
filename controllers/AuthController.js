const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  BadRequestError,
  UnauthorizedError,
  ValidationError,
  ConflictError
} = require('../utils/errors');
const { sendSuccess, formatOutputSuccess, sendResponse } = require('../utils/responseUtils');

class AuthController {
  /**
   * 用户注册
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async register(req, res, next) {
    try {
      const { username, email, password, role } = req.body;
      
      // 参数验证
      if (!username || !email || !password) {
        throw new ValidationError({
          username: username ? undefined : '用户名不能为空',
          email: email ? undefined : '邮箱不能为空',
          password: password ? undefined : '密码不能为空'
        });
      }
      
      // 密码强度验证
      if (password.length < 6) {
        throw new ValidationError({ password: '密码长度至少6位' });
      }
      
      // 邮箱格式简单验证
      if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        throw new ValidationError({ email: '邮箱格式不正确' });
      }
      
      // 检查用户名是否已存在
      const existingUser = await User.findOne({ $or: [{ username }, { email }] });
      if (existingUser) {
        throw new ConflictError(
          existingUser.username === username ? '用户名已被注册' : '邮箱已被注册',
          'USER_ALREADY_EXISTS',
          { username, email }
        );
      }
      
      // 加密密码
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // 创建新用户
      const user = new User({
        username,
        email,
        password: hashedPassword,
        role: role || 'user'
      });
      
      await user.save();
      
      // 生成JWT令牌
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      const response = formatOutputSuccess({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }, '注册成功');
      
      response.statusCode = 201;
      sendResponse(res, response);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * 用户登录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async login(req, res, next) {
    try {
      const { username, password } = req.body;
      
      // 参数验证
      if (!username || !password) {
        throw new ValidationError({
          username: username ? undefined : '用户名不能为空',
          password: password ? undefined : '密码不能为空'
        });
      }
      
      // 查找用户
      const user = await User.findOne({ username });
      if (!user) {
        throw new UnauthorizedError('用户名或密码错误', 'INVALID_CREDENTIALS');
      }
      
      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedError('用户名或密码错误', 'INVALID_CREDENTIALS');
      }
      
      // 检查JWT密钥配置
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key') {
        console.warn('警告: 使用默认JWT密钥，建议在生产环境中配置安全的JWT_SECRET');
      }
      
      // 生成JWT令牌
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      sendSuccess(res, {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }, '登录成功');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;