const OrderService = require('../services/orderService');
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ValidationError
} = require('../utils/errors');

class OrderController {
  /**
   * 创建订单
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async createOrder(req, res, next) {
    try {
      // 构建订单数据，使用硬编码的用户ID进行测试
      const orderData = {
        ...req.body,
        // 在实际系统中应该从req.user获取，这里为了测试暂时使用固定值
        user: '5f8d0f3287a9c343c8e9c5b7'
      };
      
      // 基本验证
      if (!orderData.items || orderData.items.length === 0) {
        throw new ValidationError({ items: '订单商品不能为空' });
      }
      
      if (!orderData.totalAmount || orderData.totalAmount <= 0) {
        throw new ValidationError({ totalAmount: '订单金额必须大于0' });
      }
      
      const order = await OrderService.createOrder(orderData);
      res.status(201).json({
        success: true,
        message: '订单创建成功',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取所有订单列表（餐厅用户使用）
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async getAllOrders(req, res, next) {
    try {
      // 构建过滤条件
      const filters = {
        status: req.query.status,
        paymentStatus: req.query.paymentStatus,
        auditStatus: req.query.auditStatus,
        orderNumber: req.query.orderNumber,
        userId: req.query.userId,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };
      
      // 过滤掉undefined值
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });
      
      // 构建查询选项
      const options = {
        limit: parseInt(req.query.limit) || 10,
        page: parseInt(req.query.page) || 1,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      // 验证分页参数
      if (options.page < 1) {
        throw new ValidationError({ page: '页码必须大于0' });
      }
      if (options.limit < 1 || options.limit > 100) {
        throw new ValidationError({ limit: '每页数量必须在1-100之间' });
      }
      
      const result = await OrderService.getAllOrders(filters, options);
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取订单详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async getOrderById(req, res, next) {
    try {
      if (!req.params.id) {
        throw new BadRequestError('订单ID不能为空');
      }
      
      const order = await OrderService.getOrderById(req.params.id);
      if (!order) {
        throw new NotFoundError(`订单 ${req.params.id} 不存在`, 'ORDER_NOT_FOUND', req.params.id);
      }
      
      res.status(200).json({
        success: true,
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取用户订单列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async getUserOrders(req, res, next) {
    try {
      // 检查用户认证
      if (!req.user || !req.user._id) {
        throw new UnauthorizedError('需要用户认证');
      }
      
      const options = {
        limit: parseInt(req.query.limit) || 10,
        page: parseInt(req.query.page) || 1,
        status: req.query.status
      };
      
      // 验证分页参数
      if (options.page < 1) {
        throw new ValidationError({ page: '页码必须大于0' });
      }
      
      const result = await OrderService.getUserOrders(req.user._id, options);
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 审核订单
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async auditOrder(req, res, next) {
    try {
      // 验证必要参数
      if (!req.params.id) {
        throw new BadRequestError('订单ID不能为空');
      }
      
      const { auditResult, reason } = req.body;
      
      if (!auditResult || !['approved', 'rejected'].includes(auditResult)) {
        throw new ValidationError({ auditResult: '审核结果必须是approved或rejected' });
      }
      
      if (auditResult === 'rejected' && !reason) {
        throw new ValidationError({ reason: '拒绝审核必须提供原因' });
      }
      
      const auditor = req.user?.username || 'system';
      
      const updatedOrder = await OrderService.auditOrder(
        req.params.id,
        auditResult,
        reason,
        auditor
      );
      
      res.status(200).json({
        success: true,
        message: '订单审核成功',
        data: updatedOrder
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新订单状态
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async updateOrderStatus(req, res, next) {
    try {
      // 验证参数
      if (!req.params.id) {
        throw new BadRequestError('订单ID不能为空');
      }
      
      const { status } = req.body;
      if (!status) {
        throw new ValidationError({ status: '订单状态不能为空' });
      }
      
      const updatedOrder = await OrderService.updateOrderStatus(req.params.id, status);
      
      res.status(200).json({
        success: true,
        message: '订单状态更新成功',
        data: updatedOrder
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 取消订单
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async cancelOrder(req, res, next) {
    try {
      // 验证参数
      if (!req.params.id) {
        throw new BadRequestError('订单ID不能为空');
      }
      
      const { reason } = req.body;
      if (!reason || reason.trim() === '') {
        throw new ValidationError({ reason: '取消原因不能为空' });
      }
      
      const updatedOrder = await OrderService.cancelOrder(req.params.id, reason);
      
      res.status(200).json({
        success: true,
        message: '订单取消成功',
        data: updatedOrder
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = OrderController;