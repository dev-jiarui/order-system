// 统一错误处理中间件

const {
  BaseError,
  formatErrorResponse,
  logError,
  ValidationError,
  DatabaseError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError
} = require('../utils/errors');

/**
 * 验证错误处理中间件
 * 用于处理请求参数验证失败的情况
 */
const validationErrorHandler = (err, req, res, next) => {
  // 处理Express验证错误
  if (err.name === 'ValidationError' || err.name === 'JsonSchemaValidationError') {
    const validationErrors = err.errors || {};
    const formattedErrors = Object.keys(validationErrors).reduce((acc, field) => {
      acc[field] = validationErrors[field].message || '无效的值';
      return acc;
    }, {});
    
    const validationError = new ValidationError(formattedErrors);
    return next(validationError);
  }
  
  // 处理JSON解析错误
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    const jsonError = new ValidationError({
      body: '无效的JSON格式'
    });
    return next(jsonError);
  }
  
  next(err);
};

/**
 * 数据库错误处理中间件
 * 处理数据库相关的错误
 */
const databaseErrorHandler = (err, req, res, next) => {
  // MongoDB重复键错误
  if (err.code === 11000 && err.name === 'MongoError') {
    const field = Object.keys(err.keyValue)[0];
    const error = new ValidationError({
      [field]: `${field} 已被使用`
    });
    return next(error);
  }
  
  // MongoDB验证错误
  if (err.name === 'MongoError' || err.name === 'MongooseError') {
    const dbError = new DatabaseError('数据库操作失败', 'DATABASE_ERROR', err);
    return next(dbError);
  }
  
  next(err);
};

/**
 * 统一错误处理中间件
 * 处理所有类型的错误并返回标准化响应
 */
const errorHandler = (err, req, res, next) => {
  try {
    // 记录错误日志
    logError(err, req);
    
    // 设置默认错误状态码
    let statusCode = 500;
    
    // 如果是自定义错误类的实例，使用其状态码
    if (err instanceof BaseError) {
      statusCode = err.statusCode;
    } 
    // 处理未捕获的Promise拒绝
    else if (err.name === 'AggregateError') {
      // 可以根据第一个错误类型返回相应的状态码
      const firstError = err.errors && err.errors.length > 0 ? err.errors[0] : err;
      if (firstError instanceof BaseError) {
        statusCode = firstError.statusCode;
      }
    }
    
    // 添加请求路径到错误对象
    err.path = req.originalUrl;
    
    // 格式化错误响应
    const errorResponse = formatErrorResponse(err);
    
    // 返回错误响应
    res.status(statusCode).json(errorResponse);
    
    // 如果是致命错误，可以考虑终止进程
    // if (!err.isOperational) {
    //   process.exit(1);
    // }
  } catch (error) {
    // 错误处理中间件本身出错
    console.error('错误处理中间件出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      errorCode: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 未找到路由处理中间件
 * 处理404错误
 */
const notFoundHandler = (req, res, next) => {
  const notFoundError = new NotFoundError(
    `路径 ${req.originalUrl} 不存在`,
    'ROUTE_NOT_FOUND',
    { path: req.originalUrl }
  );
  next(notFoundError);
};

/**
 * 请求超时中间件
 * 处理请求超时的情况
 */
const timeoutHandler = (timeoutMs = 30000) => {
  return (req, res, next) => {
    // 设置超时定时器
    const timeoutId = setTimeout(() => {
      const timeoutError = new ServiceUnavailableError(
        '请求处理超时',
        'REQUEST_TIMEOUT'
      );
      next(timeoutError);
    }, timeoutMs);
    
    // 清除超时定时器
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });
    
    next();
  };
};

module.exports = {
  errorHandler,
  validationErrorHandler,
  databaseErrorHandler,
  notFoundHandler,
  timeoutHandler
};