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
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB连接成功');
  } catch (error) {
    console.error('MongoDB连接失败:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;