const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 数据库索引优化
// 注意：username 和 email 的唯一索引已在 schema 字段中定义，无需重复创建

// 单字段索引：角色查询
userSchema.index({ role: 1 });

// 单字段索引：创建时间查询
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);