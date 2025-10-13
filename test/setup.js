// 测试设置文件
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// 在所有测试前执行
beforeAll(async () => {
  // 设置环境变量
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  
  try {
    // 启动内存MongoDB服务器
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test-order-system'
      }
    });
    const uri = mongoServer.getUri();
    
    // 连接到内存数据库
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // 5秒超时
      socketTimeoutMS: 45000 // 45秒socket超时
    });
    
    console.log('测试数据库连接成功');
  } catch (error) {
    console.error('测试数据库连接失败:', error);
    throw error;
  }
}, 30000); // 30秒超时

// 在每个测试后执行
afterEach(async () => {
  // 清除数据库中的所有集合
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
  }
});

// 在所有测试后执行
afterAll(async () => {
  try {
    // 断开数据库连接
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    // 停止内存MongoDB服务器
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('测试数据库清理完成');
  } catch (error) {
    console.error('测试数据库清理失败:', error);
  }
}, 30000); // 30秒超时