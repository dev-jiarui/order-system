const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 根据NODE_ENV环境变量加载对应的配置文件
const env = process.env.NODE_ENV || 'dev';
const envPath = path.resolve(__dirname, '..', `.env.${env}`);

try {
  dotenv.config({ path: envPath });
  console.log(`成功加载 ${env} 环境配置`);
} catch (error) {
  console.warn(`无法加载 ${env} 环境配置，使用默认配置`, error.message);
  dotenv.config();
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 10,          // 最大连接数
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT) || 5000, // 服务器选择超时
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT) || 45000,   // Socket超时
      bufferCommands: false     // 禁用命令缓冲
    });
    console.log('MongoDB连接成功');

    // 连接事件监听
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected');
    });

    // 优雅关闭处理
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('MongoDB连接失败:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;