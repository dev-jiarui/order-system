// 测试设置文件
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// 在所有测试前执行
beforeAll(async () => {
  // 设置环境变量
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  
  // 启动内存MongoDB服务器
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  // 连接到内存数据库
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

// 在每个测试后执行
afterEach(async () => {
  // 清除数据库中的所有集合
  const collections = await mongoose.connection.db.collections();
  for (let collection of collections) {
    await collection.deleteMany({});
  }
});

// 在所有测试后执行
afterAll(async () => {
  // 断开数据库连接
  await mongoose.connection.close();
  // 停止内存MongoDB服务器
  await mongoServer.stop();
});