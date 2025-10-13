const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../../models/User');
const Order = require('../../models/Order');
const orderRoutes = require('../../routes/orderRoutes');
const { auth } = require('../../middleware/auth');

// 创建测试应用
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // 订单路由需要认证
  app.use('/api/orders', auth, orderRoutes);

  // 添加错误处理中间件
  app.use(require('../../middleware/errorHandler').validationErrorHandler);
  app.use(require('../../middleware/errorHandler').databaseErrorHandler);
  app.use(require('../../middleware/errorHandler').errorHandler);

  return app;
};

// 创建测试用户并生成令牌
const createTestUserAndToken = async () => {
  const user = await User.create({
    username: 'ordertest',
    email: 'order@example.com',
    password: await bcrypt.hash('password123', 10),
    role: 'user'
  });

  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return { user, token };
};

// 创建测试产品
const createTestProduct = async () => {
  return {
    _id: new mongoose.Types.ObjectId(),
    name: '测试产品',
    description: '这是一个测试产品',
    price: 100,
    quantity: 10,
    category: '测试分类'
  };
};

describe('OrderController测试', () => {
  let app;
  let user;
  let token;
  let product;
  let adminUser;
  let adminToken;

  beforeEach(async () => {
    app = createTestApp();

    try {
      const userData = await createTestUserAndToken();
      user = userData.user;
      token = userData.token;

      // 创建管理员用户
      adminUser = await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin'
      });

      adminToken = jwt.sign(
        { userId: adminUser._id, role: adminUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // 创建测试产品
      product = await createTestProduct();
    } catch (error) {
      console.error('测试设置失败:', error);
      throw error;
    }
  }, 15000);

  describe('创建订单测试', () => {
    it('应该成功创建订单', async () => {
      const orderData = {
        products: [
          {
            product: product._id,
            name: product.name,
            quantity: 2,
            price: product.price
          }
        ],
        shippingAddress: '北京市朝阳区望京SOHO 100102',
        phoneNumber: '13800138000',
        paymentMethod: 'online'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('订单创建成功');
      expect(response.body.data).toBeTruthy();
      expect(response.body.data.user).toBe(user._id.toString());
      expect(response.body.data.totalAmount).toBe(200); // 100 * 2
      expect(response.body.data.status).toBe('pending');
    });

    it('应该拒绝缺少必要字段的订单请求', async () => {
      const orderData = {
        products: [
          {
            product: product._id,
            quantity: 1
          }
        ]
        // 缺少 shippingAddress 和 phoneNumber
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('获取订单测试', () => {
    let order;

    beforeEach(async () => {
      // 创建测试订单
      order = await Order.create({
        user: user._id,
        orderNumber: `ORD-${Date.now()}-TEST`,
        items: [
          {
            productId: product._id,
            productName: product.name,
            quantity: 2,
            price: product.price
          }
        ],
        shippingAddress: '北京市朝阳区望京SOHO 100102',
        phoneNumber: '13800138000',
        totalAmount: 200,
        status: 'pending'
      });
    });

    it('应该允许用户获取自己的订单列表', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.orders).toBeTruthy();
      expect(Array.isArray(response.body.orders)).toBe(true);
    });

    it('应该允许用户获取单个订单详情', async () => {
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeTruthy();
      expect(response.body.data._id).toBe(order._id.toString());
    });
  });
});