const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  guestName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    match: [/^1[3-9]\d{9}$/, '请输入有效的手机号码']
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '请输入有效的邮箱地址']
  },
  arrivalTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: '到达时间必须晚于当前时间'
    }
  },
  tableSize: {
    type: Number,
    required: true,
    min: [1, '桌位人数至少为1人'],
    max: [20, '桌位人数最多为20人']
  },
  status: {
    type: String,
    enum: ['Requested', 'Approved', 'Cancelled', 'Completed'],
    default: 'Requested'
  },
  specialRequests: {
    type: String,
    maxlength: 500,
    trim: true
  },
  // 状态变更历史
  statusHistory: [{
    status: {
      type: String,
      enum: ['Requested', 'Approved', 'Cancelled', 'Completed'],
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      maxlength: 200
    }
  }],
  // 取消原因
  cancellationReason: {
    type: String,
    maxlength: 200
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
reservationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 在状态变更时自动添加历史记录（仅在直接修改status字段时，不通过updateStatus方法时）
reservationSchema.pre('save', function(next) {
  // 只有在直接修改status且不是通过updateStatus方法时才自动添加历史记录
  // updateStatus方法会设置一个标记来跳过这个自动添加
  if (this.isModified('status') && !this.isNew && !this._skipStatusHistory) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date()
    });
  }
  next();
});

// 数据库索引优化
// 复合索引：用户预订查询（按用户ID和创建时间倒序）
reservationSchema.index({ user: 1, createdAt: -1 });

// 单字段索引：预订状态查询
reservationSchema.index({ status: 1 });

// 复合索引：按日期和状态查询（员工常用）
reservationSchema.index({ arrivalTime: 1, status: 1 });

// 复合索引：按到达时间查询（用于日期筛选）
reservationSchema.index({ arrivalTime: 1 });

// 文本索引：支持客人姓名搜索
reservationSchema.index({ guestName: 'text', email: 'text' });

// 复合索引：状态和时间查询
reservationSchema.index({ status: 1, arrivalTime: 1 });

// 虚拟字段：格式化的到达时间
reservationSchema.virtual('formattedArrivalTime').get(function() {
  return this.arrivalTime.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// 虚拟字段：预订是否可以编辑
reservationSchema.virtual('canEdit').get(function() {
  return ['Requested', 'Approved'].includes(this.status);
});

// 虚拟字段：预订是否可以取消
reservationSchema.virtual('canCancel').get(function() {
  return ['Requested', 'Approved'].includes(this.status);
});

// 实例方法：更新预订状态
reservationSchema.methods.updateStatus = function(newStatus, reason, changedBy) {
  this.status = newStatus;
  
  if (newStatus === 'Cancelled' && reason) {
    this.cancellationReason = reason;
  }
  
  // 添加状态历史记录
  this.statusHistory.push({
    status: newStatus,
    changedBy: changedBy,
    changedAt: new Date(),
    reason: reason
  });
  
  // 设置标记，跳过pre('save')钩子中的自动历史记录添加
  this._skipStatusHistory = true;
  
  // 跳过验证保存，因为状态更新不需要验证arrivalTime
  return this.save({ validateBeforeSave: false });
};

// 静态方法：按日期范围查询预订
reservationSchema.statics.findByDateRange = function(startDate, endDate, options = {}) {
  const query = {
    arrivalTime: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .populate('user', 'username email')
    .sort({ arrivalTime: 1 });
};

// 静态方法：获取今日预订
reservationSchema.statics.findTodayReservations = function(status) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  
  const query = {
    arrivalTime: {
      $gte: startOfDay,
      $lt: endOfDay
    }
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .populate('user', 'username email')
    .sort({ arrivalTime: 1 });
};

// 确保虚拟字段在JSON序列化时包含
reservationSchema.set('toJSON', { virtuals: true });
reservationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Reservation', reservationSchema);