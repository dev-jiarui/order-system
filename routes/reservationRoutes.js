const express = require('express');
const router = express.Router();
const ReservationController = require('../controllers/reservationController');
const { auth: authenticateToken, adminAuth } = require('../middleware/auth');

// 应用认证中间件到所有预订路由
router.use(authenticateToken);

// 预订路由 - 确保静态路由在动态路由之前

// 获取今日预订（管理员使用）
router.get('/today', adminAuth, ReservationController.getTodayReservations);

// 获取所有预订列表（管理员使用）
router.get('/admin', adminAuth, ReservationController.getAllReservations);

// 创建预订
router.post('/', ReservationController.createReservation);

// 获取用户预订列表
router.get('/', ReservationController.getUserReservations);

// 获取预订详情
router.get('/:id', ReservationController.getReservationById);

// 更新预订信息
router.put('/:id', ReservationController.updateReservation);

// 更新预订状态（管理员使用）
router.put('/:id/status', adminAuth, ReservationController.updateReservationStatus);

// 取消预订
router.put('/:id/cancel', ReservationController.cancelReservation);

module.exports = router;