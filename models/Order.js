const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  items: [{
    productId: {
      type: String,
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded'],
    default: 'unpaid'
  },
  shippingAddress: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  auditStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  auditReason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 自动更新updatedAt字段
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 数据库索引优化
// 注意：orderNumber 的唯一索引已在 schema 字段中定义，无需重复创建

// 复合索引：用户订单查询（按用户ID和创建时间倒序）
orderSchema.index({ user: 1, createdAt: -1 });

// 单字段索引：订单状态查询
orderSchema.index({ status: 1 });

// 单字段索引：支付状态查询
orderSchema.index({ paymentStatus: 1 });

// 单字段索引：审核状态查询
orderSchema.index({ auditStatus: 1 });

// 复合索引：状态和时间查询
orderSchema.index({ status: 1, createdAt: -1 });

// 复合索引：用户和状态查询
orderSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);