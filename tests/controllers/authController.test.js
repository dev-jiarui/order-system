const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const AuthController = require('../../controllers/AuthController');
const { auth } = require('../../middleware/auth');
const authRoutes = require('../../routes/authRoutes');

// 创建测试应用
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  
  // 添加错误处理中间件
  app.use(require('../../middleware/errorHandler').validationErrorHandler);
  app.use(require('../../middleware/errorHandler').databaseErrorHandler);
  app.use(require('../../middleware/errorHandler').errorHandler);
  
  return app;
};

describe('AuthController测试', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe('用户注册测试', () => {
    it('应该成功注册新用户', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('注册成功');
      expect(response.body.token).toBeTruthy();
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.email).toBe(userData.email);
      
      // 验证用户是否已保存到数据库
      const savedUser = await User.findOne({ username: userData.username });
      expect(savedUser).toBeTruthy();
      expect(savedUser.email).toBe(userData.email);
      
      // 验证密码是否已加密
      const isPasswordValid = await bcrypt.compare(userData.password, savedUser.password);
      expect(isPasswordValid).toBe(true);
    });

    it('应该拒绝重复用户名注册', async () => {
      // 先创建一个用户
      await User.create({
        username: 'existinguser',
        email: 'existing@example.com',
        password: await bcrypt.hash('password123', 10)
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'existinguser',
          email: 'new@example.com',
          password: 'password123'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('USER_ALREADY_EXISTS');
    });

    it('应该拒绝缺少必要字段的注册请求', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser'
          // 缺少email和password
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('应该验证密码长度', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: '123' // 密码太短
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('应该验证邮箱格式', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('用户登录测试', () => {
    beforeEach(async () => {
      // 创建测试用户
      await User.create({
        username: 'loginuser',
        email: 'login@example.com',
        password: await bcrypt.hash('correctpassword', 10)
      });
    });

    it('应该成功登录并返回令牌', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'loginuser',
          password: 'correctpassword'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.token).toBeTruthy();
      
      // 验证令牌是否有效
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded.userId).toBeTruthy();
    });

    it('应该拒绝使用错误密码登录', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'loginuser',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('应该拒绝使用不存在的用户名登录', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistentuser',
          password: 'anypassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('应该拒绝缺少字段的登录请求', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'loginuser'
          // 缺少password
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('JWT认证中间件测试', () => {
    let token;
    let userId;

    beforeEach(async () => {
      // 创建测试用户并生成令牌
      const user = await User.create({
        username: 'authtest',
        email: 'auth@example.com',
        password: await bcrypt.hash('password123', 10)
      });
      
      userId = user._id.toString();
      token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // 添加测试路由
      app.get('/api/protected', auth, (req, res) => {
        res.json({ success: true, user: req.user.username });
      });
    });

    it('应该允许带有有效令牌的请求', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBe('authtest');
    });

    it('应该拒绝缺少令牌的请求', async () => {
      const response = await request(app)
        .get('/api/protected')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('MISSING_TOKEN');
    });

    it('应该拒绝无效令牌的请求', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_TOKEN');
    });

    it('应该拒绝已删除用户的令牌', async () => {
      // 删除用户
      await User.findByIdAndDelete(userId);

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('USER_NOT_FOUND');
    });
  });
});