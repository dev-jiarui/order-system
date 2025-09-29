const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');

// 注册路由
router.post('/register', AuthController.register);

// 登录路由
router.post('/login', AuthController.login);

module.exports = router;