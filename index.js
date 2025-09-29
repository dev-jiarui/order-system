const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const orderRoutes = require('./routes/orderRoutes');
const authRoutes = require('./routes/authRoutes');
// 导入错误处理中间件
const {
  errorHandler,
  validationErrorHandler,
  databaseErrorHandler,
  notFoundHandler,
  timeoutHandler
} = require('./middleware/errorHandler');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 连接数据库
connectDB();

// 中间件配置
app.use(timeoutHandler(30000)); // 请求超时处理，30秒超时
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 路由配置
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);

// 404路由处理
app.use(notFoundHandler);

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Order System is running',
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件链
app.use(validationErrorHandler); // 验证错误处理
app.use(databaseErrorHandler); // 数据库错误处理
app.use(errorHandler); // 统一错误处理

// 获取端口
const PORT = process.env.PORT || 3000;

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

// 导出app，用于华为云FunctionGraph
module.exports = app;