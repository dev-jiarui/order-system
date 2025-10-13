/**
 * 数据库初始化脚本
 * 用于创建索引和初始化数据
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 导入模型以确保索引被创建
const User = require('../models/User');
const Order = require('../models/Order');

// 加载环境配置
const env = process.env.NODE_ENV || 'dev';
const envPath = path.resolve(__dirname, '..', `.env.${env}`);

try {
  dotenv.config({ path: envPath });
  console.log(`加载 ${env} 环境配置`);
} catch (error) {
  console.warn(`无法加载 ${env} 环境配置，使用默认配置`);
  dotenv.config();
}

async function initDatabase() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });

    console.log('✅ 数据库连接成功');

    // 确保索引被创建
    console.log('🔄 正在创建数据库索引...');
    
    await User.createIndexes();
    console.log('✅ User 模型索引创建完成');
    
    await Order.createIndexes();
    console.log('✅ Order 模型索引创建完成');

    // 显示已创建的索引
    const userIndexes = await User.collection.getIndexes();
    const orderIndexes = await Order.collection.getIndexes();

    console.log('\n📊 User 集合索引:');
    Object.keys(userIndexes).forEach(indexName => {
      console.log(`  - ${indexName}: ${JSON.stringify(userIndexes[indexName])}`);
    });

    console.log('\n📊 Order 集合索引:');
    Object.keys(orderIndexes).forEach(indexName => {
      console.log(`  - ${indexName}: ${JSON.stringify(orderIndexes[indexName])}`);
    });

    console.log('\n🎉 数据库初始化完成!');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 数据库连接已关闭');
    process.exit(0);
  }
}

// 运行初始化
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;