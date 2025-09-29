const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../../models/User');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
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
  return await Product.create({
    name: '测试产品',
    description: '这是一个测试产品',
    price: 100,
    quantity: 10,
    category: '测试分类'
  });
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
    
    // 创建普通用户和令牌
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
  });
  
  describe('创建订单测试', () => {
    it('应该成功创建订单', async () => {
      const orderData = {
        products: [
          {
            product: product._id,
            quantity: 2
          }
        ],
        shippingAddress: {
          city: '北京',
          district: '朝阳区',
          street: '望京SOHO',
          zipCode: '100102'
        },
        paymentMethod: 'online'
      };
      
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(orderData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('订单创建成功');
      expect(response.body.order).toBeTruthy();
      expect(response.body.order.user).toBe(user._id.toString());
      expect(response.body.order.totalAmount).toBe(200); // 100 * 2
      expect(response.body.order.status).toBe('pending');
      
      // 验证订单是否已保存到数据库
      const savedOrder = await Order.findById(response.body.order._id);
      expect(savedOrder).toBeTruthy();
      expect(savedOrder.user.toString()).toBe(user._id.toString());
    });
    
    it('应该拒绝创建包含不存在产品的订单', async () => {
      const orderData = {
        products: [
          {
            product: new mongoose.Types.ObjectId(), // 不存在的产品ID
            quantity: 1
          }
        ],
        shippingAddress: {
          city: '北京',
          district: '朝阳区',
          street: '望京SOHO',
          zipCode: '100102'
        },
        paymentMethod: 'online'
      };
      
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(orderData)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('PRODUCT_NOT_FOUND');
    });
    
    it('应该拒绝创建数量超过库存的订单', async () => {
      const orderData = {
        products: [
          {
            product: product._id,
            quantity: 20 // 超过库存10
          }
        ],
        shippingAddress: {
          city: '北京',
          district: '朝阳区',
          street: '望京SOHO',
          zipCode: '100102'
        },
        paymentMethod: 'online'
      };
      
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(orderData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INSUFFICIENT_STOCK');
    });
    
    it('应该拒绝缺少必要字段的订单请求', async () => {
      const orderData = {
        products: [
          {
            product: product._id,
            quantity: 1
          }
        ]
        // 缺少shippingAddress和paymentMethod
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
        products: [
          {
            product: product._id,
            quantity: 2,
            price: 100
          }
        ],
        shippingAddress: {
          city: '北京',
          district: '朝阳区',
          street: '望京SOHO',
          zipCode: '100102'
        },
        paymentMethod: 'online',
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
      expect(response.body.orders.length).toBeGreaterThan(0);
    });
    
    it('应该允许用户获取单个订单详情', async () => {
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.order._id).toBe(order._id.toString());
      expect(response.body.order.user).toBe(user._id.toString());
    });
    
    it('应该拒绝用户访问其他用户的订单', async () => {
      // 创建另一个用户
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@example.com',
        password: await bcrypt.hash('password123', 10)
      });
      
      const otherToken = jwt.sign(
        { userId: otherUser._id, role: otherUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('ACCESS_DENIED');
    });
    
    it('应该允许管理员获取所有订单', async () => {
      const response = await request(app)
        .get('/api/orders/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.orders).toBeTruthy();
      expect(Array.isArray(response.body.orders)).toBe(true);
    });
    
    it('应该拒绝普通用户访问管理员订单路由', async () => {
      const response = await request(app)
        .get('/api/orders/admin')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('PERMISSION_DENIED');
    });
    
    it('应该处理查询不存在订单的情况', async () => {
      const response = await request(app)
        .get(`/api/orders/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('ORDER_NOT_FOUND');
    });
  });
  
  describe('更新订单状态测试', () => {
    let order;
    
    beforeEach(async () => {
      // 创建测试订单
      order = await Order.create({
        user: user._id,
        products: [
          {
            product: product._id,
            quantity: 2,
            price: 100
          }
        ],
        shippingAddress: {
          city: '北京',
          district: '朝阳区',
          street: '望京SOHO',
          zipCode: '100102'
        },
        paymentMethod: 'online',
        totalAmount: 200,
        status: 'pending'
      });
    });
    
    it('应该允许管理员更新订单状态为已发货', async () => {
      const response = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('订单状态更新成功');
      expect(response.body.order.status).toBe('shipped');
      
      // 验证数据库中的状态已更新
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.status).toBe('shipped');
    });
    
    it('应该允许管理员更新订单状态为已完成', async () => {
      const response = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'completed' })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.order.status).toBe('completed');
    });
    
    it('应该拒绝普通用户更新订单状态', async () => {
      const response = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'shipped' })
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('PERMISSION_DENIED');
    });
    
    it('应该拒绝无效的订单状态更新', async () => {
      const response = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });
  
  describe('取消订单测试', () => {
    let order;
    
    beforeEach(async () => {
      // 创建测试订单
      order = await Order.create({
        user: user._id,
        products: [
          {
            product: product._id,
            quantity: 2,
            price: 100
          }
        ],
        shippingAddress: {
          city: '北京',
          district: '朝阳区',
          street: '望京SOHO',
          zipCode: '100102'
        },
        paymentMethod: 'online',
        totalAmount: 200,
        status: 'pending'
      });
    });
    
    it('应该允许用户取消待处理的订单', async () => {
      const response = await request(app)
        .put(`/api/orders/${order._id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('订单取消成功');
      expect(response.body.order.status).toBe('cancelled');
      
      // 验证数据库中的状态已更新
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.status).toBe('cancelled');
    });
    
    it('应该拒绝取消非待处理状态的订单', async () => {
      // 先更新订单状态为已发货
      await Order.findByIdAndUpdate(order._id, { status: 'shipped' });
      
      const response = await request(app)
        .put(`/api/orders/${order._id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('ORDER_CANCEL_FAILED');
    });
    
    it('应该拒绝用户取消其他用户的订单', async () => {
      // 创建另一个用户
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@example.com',
        password: await bcrypt.hash('password123', 10)
      });
      
      const otherToken = jwt.sign(
        { userId: otherUser._id, role: otherUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      const response = await request(app)
        .put(`/api/orders/${order._id}/cancel`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('ACCESS_DENIED');
    });
  });
});