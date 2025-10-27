const Reservation = require('../models/Reservation');
const { NotFoundError, ValidationError, BadRequestError } = require('../utils/errors');

class ReservationService {
  /**
   * 创建预订
   * @param {Object} reservationData - 预订数据
   * @returns {Promise<Object>} 创建的预订
   */
  static async createReservation(reservationData) {
    const reservation = new Reservation(reservationData);
    await reservation.save({ validateBeforeSave: false });
    await reservation.populate('user', 'username email role');
    return reservation;
  }

  /**
   * 获取用户的预订列表
   * @param {String} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 预订列表和分页信息
   */
  static async getUserReservations(userId, options = {}) {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'arrivalTime',
      sortOrder = 'desc'
    } = options;

    const query = { user: userId };
    
    if (status) {
      query.status = status;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [reservations, total] = await Promise.all([
      Reservation.find(query)
        .populate('user', 'username email role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Reservation.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      reservations,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  /**
   * 获取所有预订列表（管理员使用）
   * @param {Object} filters - 筛选条件
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 预订列表和分页信息
   */
  static async getAllReservations(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'arrivalTime',
      sortOrder = 'desc'
    } = options;

    const query = {};

    // 状态筛选
    if (filters.status) {
      query.status = filters.status;
    }

    // 日期筛选
    if (filters.startDate || filters.endDate) {
      query.arrivalTime = {};
      if (filters.startDate) {
        query.arrivalTime.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.arrivalTime.$lte = new Date(filters.endDate);
      }
    }

    // 搜索筛选（客人姓名或邮箱）
    if (filters.searchTerm) {
      query.$or = [
        { guestName: { $regex: filters.searchTerm, $options: 'i' } },
        { email: { $regex: filters.searchTerm, $options: 'i' } }
      ];
    }

    // 用户ID筛选
    if (filters.userId) {
      query.user = filters.userId;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [reservations, total] = await Promise.all([
      Reservation.find(query)
        .populate('user', 'username email role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Reservation.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      reservations,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  /**
   * 根据ID获取预订详情
   * @param {String} reservationId - 预订ID
   * @returns {Promise<Object>} 预订详情
   */
  static async getReservationById(reservationId) {
    const reservation = await Reservation.findById(reservationId)
      .populate('user', 'username email role')
      .populate('statusHistory.changedBy', 'username');

    if (!reservation) {
      throw new NotFoundError(`预订 ${reservationId} 不存在`, 'RESERVATION_NOT_FOUND', reservationId);
    }

    return reservation;
  }

  /**
   * 更新预订信息
   * @param {String} reservationId - 预订ID
   * @param {String} userId - 用户ID
   * @param {Object} updates - 更新数据
   * @returns {Promise<Object>} 更新后的预订
   */
  static async updateReservation(reservationId, userId, updates) {
    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      throw new NotFoundError(`预订 ${reservationId} 不存在`, 'RESERVATION_NOT_FOUND', reservationId);
    }

    // 检查权限：只有预订的用户才能更新
    if (reservation.user.toString() !== userId.toString()) {
      console.info(`用户ID:${userId}，预订用户ID:${reservation.user}`);
      throw new BadRequestError('您只能修改自己的预订');
    }

    // 检查预订状态是否允许修改
    if (!reservation.canEdit) {
      throw new BadRequestError('该预订状态不允许修改');
    }

    // 只允许更新特定字段
    const allowedUpdates = ['guestName', 'phoneNumber', 'email', 'arrivalTime', 'tableSize', 'specialRequests'];
    const updateData = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    // 如果更新到达时间，检查冲突
    if (updateData.arrivalTime) {
      const existingReservation = await Reservation.findOne({
        _id: { $ne: reservationId },
        user: userId,
        arrivalTime: {
          $gte: new Date(new Date(updateData.arrivalTime).getTime() - 2 * 60 * 60 * 1000),
          $lte: new Date(new Date(updateData.arrivalTime).getTime() + 2 * 60 * 60 * 1000)
        },
        status: { $in: ['Requested', 'Approved'] }
      });

      if (existingReservation) {
        throw new ValidationError({ arrivalTime: '您在该时间段已有其他预订，请选择其他时间' });
      }
    }

    Object.assign(reservation, updateData);
    await reservation.save();
    
    await reservation.populate('user', 'username email role');
    return reservation;
  }

  /**
   * 更新预订状态（管理员使用）
   * @param {String} reservationId - 预订ID
   * @param {String} status - 新状态
   * @param {String} reason - 状态变更原因
   * @param {String} changedBy - 操作员ID
   * @returns {Promise<Object>} 更新后的预订
   */
  static async updateReservationStatus(reservationId, status, reason, changedBy) {
    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      throw new NotFoundError(`预订 ${reservationId} 不存在`, 'RESERVATION_NOT_FOUND', reservationId);
    }

    // 验证状态转换的合理性
    const validTransitions = {
      'Requested': ['Approved', 'Cancelled'],
      'Approved': ['Completed', 'Cancelled'],
      'Cancelled': [], // 已取消的预订不能再变更
      'Completed': [] // 已完成的预订不能再变更
    };

    if (!validTransitions[reservation.status].includes(status)) {
      throw new BadRequestError(`不能将状态从 ${reservation.status} 变更为 ${status}`);
    }

    await reservation.updateStatus(status, reason, changedBy);
    await reservation.populate('user', 'username email role');
    
    return reservation;
  }

  /**
   * 取消预订
   * @param {String} reservationId - 预订ID
   * @param {String} userId - 用户ID
   * @param {String} reason - 取消原因
   * @returns {Promise<Object>} 更新后的预订
   */
  static async cancelReservation(reservationId, userId, reason) {
    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      throw new NotFoundError(`预订 ${reservationId} 不存在`, 'RESERVATION_NOT_FOUND', reservationId);
    }

    // 检查权限：只有预订的用户才能取消
    if (reservation.user.toString() !== userId.toString()) {
      console.log('User ID mismatch:', {
        reservationUser: reservation.user.toString(),
        currentUser: userId.toString(),
        reservationUserType: typeof reservation.user,
        currentUserType: typeof userId
      });
      throw new BadRequestError('您只能取消自己的预订');
    }

    // 检查预订状态是否允许取消
    if (!reservation.canCancel) {
      throw new BadRequestError('该预订状态不允许取消');
    }

    await reservation.updateStatus('Cancelled', reason, userId);
    await reservation.populate('user', 'username email role');
    
    return reservation;
  }

  /**
   * 获取今日预订
   * @param {String} status - 状态筛选
   * @returns {Promise<Array>} 今日预订列表
   */
  static async getTodayReservations(status) {
    return await Reservation.findTodayReservations(status);
  }

  /**
   * 按日期范围获取预订
   * @param {String} startDate - 开始日期
   * @param {String} endDate - 结束日期
   * @param {Object} options - 其他选项
   * @returns {Promise<Array>} 预订列表
   */
  static async getReservationsByDateRange(startDate, endDate, options = {}) {
    return await Reservation.findByDateRange(startDate, endDate, options);
  }
}

module.exports = ReservationService;