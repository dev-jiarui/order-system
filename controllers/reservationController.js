const ReservationService = require('../services/reservationService');
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ValidationError
} = require('../utils/errors');
const { sendSuccess, formatOutputSuccess, sendResponse } = require('../utils/responseUtils');

class ReservationController {
  /**
   * 创建预订
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async createReservation(req, res, next) {
    try {
      // 构建预订数据，从认证中间件获取用户信息
      const reservationData = {
        ...req.body,
        user: req.user._id
      };

      // 基本验证
      const requiredFields = ['guestName', 'phoneNumber', 'email', 'arrivalTime', 'tableSize'];
      const missingFields = requiredFields.filter(field => !reservationData[field]);
      
      if (missingFields.length > 0) {
        const errors = {};
        missingFields.forEach(field => {
          errors[field] = '此字段为必填项';
        });
        throw new ValidationError(errors);
      }

      // 验证到达时间
      const arrivalTime = new Date(reservationData.arrivalTime);
      if (arrivalTime <= new Date()) {
        throw new ValidationError({ arrivalTime: '到达时间必须晚于当前时间' });
      }

      // 验证营业时间 (10:00-22:00)
      const hours = arrivalTime.getHours();
      if (hours < 10 || hours >= 22) {
        throw new ValidationError({ arrivalTime: '请选择营业时间内的时间 (10:00-22:00)' });
      }

      const reservation = await ReservationService.createReservation(reservationData);
      const response = formatOutputSuccess(reservation, '预订创建成功');
      response.statusCode = 201;
      sendResponse(res, response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取用户预订列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async getUserReservations(req, res, next) {
    try {
      // 检查用户认证
      if (!req.user || !req.user._id) {
        throw new UnauthorizedError('需要用户认证');
      }

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        status: req.query.status,
        sortBy: req.query.sortBy || 'arrivalTime',
        sortOrder: req.query.sortOrder || 'desc'
      };

      // 验证分页参数
      if (options.page < 1) {
        throw new ValidationError({ page: '页码必须大于0' });
      }
      if (options.limit < 1 || options.limit > 100) {
        throw new ValidationError({ limit: '每页数量必须在1-100之间' });
      }

      const result = await ReservationService.getUserReservations(req.user._id, options);
      
      const pagination = {
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      };
      
      sendSuccess(res, result.reservations, 'success', result.total, pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取所有预订列表（管理员使用）
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async getAllReservations(req, res, next) {
    try {
      // 构建筛选条件
      const filters = {
        status: req.query.status,
        userId: req.query.userId,
        searchTerm: req.query.search,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      // 过滤掉undefined值
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      // 如果没有指定日期范围，不设置日期过滤（显示所有预订）
      // 注释掉默认今天的逻辑，让管理员可以查看所有预订
      // if (!filters.startDate && !filters.endDate) {
      //   const today = new Date();
      //   filters.startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      //   filters.endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      // }

      // 构建查询选项
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortBy: req.query.sortBy || 'arrivalTime',
        sortOrder: req.query.sortOrder || 'desc' // 默认倒序
      };

      // 验证分页参数
      if (options.page < 1) {
        throw new ValidationError({ page: '页码必须大于0' });
      }
      if (options.limit < 1 || options.limit > 100) {
        throw new ValidationError({ limit: '每页数量必须在1-100之间' });
      }

      const result = await ReservationService.getAllReservations(filters, options);
      
      const pagination = {
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      };
      
      sendSuccess(res, result.reservations, 'success', result.total, pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取预订详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async getReservationById(req, res, next) {
    try {
      if (!req.params.id) {
        throw new BadRequestError('预订ID不能为空');
      }

      const reservation = await ReservationService.getReservationById(req.params.id);
      
      // 检查权限：普通用户只能查看自己的预订，管理员可以查看所有预订
      if (req.user.role !== 'admin' && reservation.user._id.toString() !== req.user._id.toString()) {
        throw new UnauthorizedError('您只能查看自己的预订');
      }

      sendSuccess(res, reservation);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新预订信息
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async updateReservation(req, res, next) {
    try {
      if (!req.params.id) {
        throw new BadRequestError('预订ID不能为空');
      }

      if (!req.user || !req.user._id) {
        throw new UnauthorizedError('需要用户认证');
      }

      const updates = req.body;
      
      // 验证更新数据
      if (updates.arrivalTime) {
        const arrivalTime = new Date(updates.arrivalTime);
        if (arrivalTime <= new Date()) {
          throw new ValidationError({ arrivalTime: '到达时间必须晚于当前时间' });
        }

        const hours = arrivalTime.getHours();
        if (hours < 10 || hours >= 22) {
          throw new ValidationError({ arrivalTime: '请选择营业时间内的时间 (10:00-22:00)' });
        }
      }

      const updatedReservation = await ReservationService.updateReservation(
        req.params.id,
        req.user._id,
        updates
      );

      sendSuccess(res, updatedReservation, '预订更新成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新预订状态（管理员使用）
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async updateReservationStatus(req, res, next) {
    try {
      // 验证必要参数
      if (!req.params.id) {
        throw new BadRequestError('预订ID不能为空');
      }

      const { status, reason } = req.body;

      if (!status || !['Approved', 'Cancelled', 'Completed'].includes(status)) {
        throw new ValidationError({ status: '状态必须是Approved、Cancelled或Completed之一' });
      }

      if (status === 'Cancelled' && !reason) {
        throw new ValidationError({ reason: '取消预订必须提供原因' });
      }

      const changedBy = req.user?._id || 'system';

      const updatedReservation = await ReservationService.updateReservationStatus(
        req.params.id,
        status,
        reason,
        changedBy
      );

      sendSuccess(res, updatedReservation, '预订状态更新成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 取消预订
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async cancelReservation(req, res, next) {
    try {
      // 验证参数
      if (!req.params.id) {
        throw new BadRequestError('预订ID不能为空');
      }

      if (!req.user || !req.user._id) {
        throw new UnauthorizedError('需要用户认证');
      }

      const { reason } = req.body;
      if (!reason || reason.trim() === '') {
        throw new ValidationError({ reason: '取消原因不能为空' });
      }

      const updatedReservation = await ReservationService.cancelReservation(
        req.params.id,
        req.user._id,
        reason
      );

      sendSuccess(res, updatedReservation, '预订取消成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取今日预订
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  static async getTodayReservations(req, res, next) {
    try {
      const status = req.query.status;
      const reservations = await ReservationService.getTodayReservations(status);
      sendSuccess(res, reservations, 'success');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReservationController;