const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const orderRoutes = require('./routes/orderRoutes');
const authRoutes = require('./routes/authRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
// 导入错误处理中间件
const {
  errorHandler,
  validationErrorHandler,
  databaseErrorHandler,
  notFoundHandler,
  timeoutHandler
} = require('./middleware/errorHandler');
const { sendSuccess } = require('./utils/responseUtils');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 连接数据库
connectDB();

// 中间件配置
app.use(timeoutHandler(30000)); // 请求超时处理，30秒超时

// CORS配置 - 允许前端访问
app.use(cors({
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 路由配置
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reservations', reservationRoutes);

// 健康检查路由
app.get('/health', (req, res) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString()
  }, 'Order System is running');
});

// 404路由处理 - 必须放在所有路由之后
app.use(notFoundHandler);

// 错误处理中间件链
app.use(validationErrorHandler); // 验证错误处理
app.use(databaseErrorHandler); // 数据库错误处理
app.use(errorHandler); // 统一错误处理

// 获取端口
const PORT = process.env.PORT || 3002;

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

// 导出app，用于华为云FunctionGraph
module.exports = app;