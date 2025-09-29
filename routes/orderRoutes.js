const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');

// 订单路由 - 确保静态路由在动态路由之前
router.post('/create', OrderController.createOrder); // 创建订单
router.get('/', OrderController.getUserOrders); // 获取用户订单列表
router.get('/all', OrderController.getAllOrders); // 获取所有订单列表（餐厅用户使用）
router.get('/:id', OrderController.getOrderById); // 获取订单详情
router.put('/:id/audit', OrderController.auditOrder); // 审核订单
router.put('/:id/status', OrderController.updateOrderStatus); // 更新订单状态
router.put('/:id/cancel', OrderController.cancelOrder); // 取消订单

module.exports = router;