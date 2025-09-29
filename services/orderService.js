const Order = require('../models/Order');
const AuditUtils = require('../utils/auditUtils');

class OrderService {
  /**
   * 创建新订单
   * @param {Object} orderData - 订单数据
   * @returns {Promise<Object>} 创建的订单
   */
  static async createOrder(orderData) {
    try {
      // 生成订单号
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // 创建订单
      const order = new Order({
        ...orderData,
        orderNumber,
        auditStatus: 'pending'
      });
      
      const savedOrder = await order.save();
      return savedOrder;
    } catch (error) {
      console.error('创建订单失败:', error.message);
      throw new Error(`创建订单失败: ${error.message}`);
    }
  }

  /**
   * 获取订单详情
   * @param {string} orderId - 订单ID
   * @returns {Promise<Object>} 订单详情
   */
  static async getOrderById(orderId) {
    try {
      const order = await Order.findById(orderId).populate('user', 'username email');
      if (!order) {
        throw new Error('订单不存在');
      }
      return order;
    } catch (error) {
      console.error('获取订单失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取用户的订单列表
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 订单列表
   */
  static async getUserOrders(userId, options = {}) {
    try {
      const { limit = 10, page = 1, status } = options;
      const skip = (page - 1) * limit;
      
      const query = { user: userId };
      if (status) query.status = status;
      
      const orders = await Order.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
      
      const total = await Order.countDocuments(query);
      
      return {
        orders,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('获取用户订单失败:', error.message);
      throw new Error(`获取用户订单失败: ${error.message}`);
    }
  }

  /**
   * 审核订单
   * @param {string} orderId - 订单ID
   * @param {string} auditResult - 审核结果
   * @param {string} reason - 审核理由
   * @param {string} auditor - 审核人
   * @returns {Promise<Object>} 更新后的订单
   */
  static async auditOrder(orderId, auditResult, reason, auditor) {
    try {
      // 查找订单
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('订单不存在');
      }
      
      // 检查是否可以审核
      if (!AuditUtils.canAuditOrder(order)) {
        throw new Error('该订单无法审核');
      }
      
      // 使用审核工具类进行审核
      const updatedOrder = await AuditUtils.auditOrder(order, auditResult, reason, auditor);
      
      // 保存更新后的订单
      await updatedOrder.save();
      
      return updatedOrder;
    } catch (error) {
      console.error('审核订单失败:', error.message);
      throw error;
    }
  }

  /**
   * 更新订单状态
   * @param {string} orderId - 订单ID
   * @param {string} status - 新状态
   * @returns {Promise<Object>} 更新后的订单
   */
  static async updateOrderStatus(orderId, status) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('订单不存在');
      }
      
      order.status = status;
      await order.save();
      
      return order;
    } catch (error) {
      console.error('更新订单状态失败:', error.message);
      throw new Error(`更新订单状态失败: ${error.message}`);
    }
  }

  /**
   * 取消订单
   * @param {string} orderId - 订单ID
   * @param {string} reason - 取消理由
   * @returns {Promise<Object>} 更新后的订单
   */
  static async cancelOrder(orderId, reason) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('订单不存在');
      }
      
      // 检查订单是否可以取消
      if (order.status === 'delivered' || order.status === 'cancelled') {
        throw new Error('该订单无法取消');
      }
      
      order.status = 'cancelled';
      order.cancellationReason = reason;
      await order.save();
      
      return order;
    } catch (error) {
      console.error('取消订单失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取所有订单列表（餐厅用户使用）
   * @param {Object} filters - 过滤条件
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 订单列表及分页信息
   */
  static async getAllOrders(filters = {}, options = {}) {
    try {
      const { limit = 10, page = 1, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;
      
      // 构建查询条件
      const query = {};
      
      // 添加过滤条件
      if (filters.status) query.status = filters.status;
      if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
      if (filters.auditStatus) query.auditStatus = filters.auditStatus;
      if (filters.orderNumber) query.orderNumber = filters.orderNumber;
      if (filters.userId) query.user = filters.userId;
      
      // 添加日期范围过滤
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }
      
      // 构建排序选项
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // 查询订单列表
      const orders = await Order.find(query)
        .populate('user', 'username email')
        .sort(sort)
        .limit(limit)
        .skip(skip);
      
      // 获取总数
      const total = await Order.countDocuments(query);
      
      return {
        orders,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('获取所有订单失败:', error.message);
      throw new Error(`获取所有订单失败: ${error.message}`);
    }
  }
}

module.exports = OrderService;