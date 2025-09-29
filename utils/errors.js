// 自定义错误类，用于统一的错误处理

/**
 * 基础错误类
 */
class BaseError extends Error {
  constructor(message, statusCode, errorCode, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    
    // 捕获错误堆栈
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 - 请求参数错误
 */
class BadRequestError extends BaseError {
  constructor(message = '请求参数错误', errorCode = 'BAD_REQUEST', details = null) {
    super(message, 400, errorCode, details);
  }
}

/**
 * 401 - 未授权错误
 */
class UnauthorizedError extends BaseError {
  constructor(message = '未授权访问', errorCode = 'UNAUTHORIZED') {
    super(message, 401, errorCode);
  }
}

/**
 * 403 - 禁止访问错误
 */
class ForbiddenError extends BaseError {
  constructor(message = '禁止访问', errorCode = 'FORBIDDEN') {
    super(message, 403, errorCode);
  }
}

/**
 * 404 - 资源不存在错误
 */
class NotFoundError extends BaseError {
  constructor(message = '资源不存在', errorCode = 'NOT_FOUND', resource = null) {
    super(message, 404, errorCode, { resource });
  }
}

/**
 * 409 - 资源冲突错误
 */
class ConflictError extends BaseError {
  constructor(message = '资源冲突', errorCode = 'CONFLICT') {
    super(message, 409, errorCode);
  }
}

/**
 * 500 - 服务器内部错误
 */
class InternalServerError extends BaseError {
  constructor(message = '服务器内部错误', errorCode = 'INTERNAL_ERROR', details = null) {
    super(message, 500, errorCode, details);
  }
}

/**
 * 503 - 服务不可用错误
 */
class ServiceUnavailableError extends BaseError {
  constructor(message = '服务暂时不可用', errorCode = 'SERVICE_UNAVAILABLE') {
    super(message, 503, errorCode);
  }
}

/**
 * 验证错误类
 */
class ValidationError extends BadRequestError {
  constructor(validationErrors) {
    super('请求数据验证失败', 'VALIDATION_ERROR', validationErrors);
  }
}

/**
 * 数据库错误类
 */
class DatabaseError extends InternalServerError {
  constructor(message = '数据库操作失败', errorCode = 'DATABASE_ERROR', originalError = null) {
    super(message, errorCode, { originalError: originalError?.message || originalError });
  }
}

/**
 * API错误响应格式化函数
 */
const formatErrorResponse = (err) => {
  // 生产环境下不返回敏感错误信息
  const isProduction = process.env.NODE_ENV === 'production';
  
  const response = {
    success: false,
    message: err.message || '未知错误',
    errorCode: err.errorCode || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString(),
    path: err.path || undefined
  };
  
  // 只有开发环境返回详细错误信息
  if (!isProduction && err.details) {
    response.details = err.details;
  }
  
  // 非生产环境且是未处理的错误，返回堆栈信息
  if (!isProduction && !err.isOperational) {
    response.stack = err.stack;
  }
  
  return response;
};

/**
 * 错误日志记录函数
 */
const logError = (err, req = null) => {
  const logData = {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      details: err.details
    },
    timestamp: new Date().toISOString()
  };
  
  // 如果有请求信息，记录请求详情
  if (req) {
    logData.request = {
      method: req.method,
      url: req.originalUrl,
      headers: { ...req.headers },
      body: { ...req.body },
      params: { ...req.params },
      query: { ...req.query },
      ip: req.ip
    };
    
    // 移除敏感信息
    if (logData.request.headers) {
      delete logData.request.headers.authorization;
      delete logData.request.headers.cookie;
    }
    if (logData.request.body) {
      delete logData.request.body.password;
      delete logData.request.body.passwordConfirm;
    }
  }
  
  // 记录错误日志
  console.error('API错误:', JSON.stringify(logData, null, 2));
  
  // 这里可以集成错误监控服务，如Sentry、ELK等
  // sendToErrorMonitoringService(logData);
};

module.exports = {
  BaseError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError,
  ValidationError,
  DatabaseError,
  formatErrorResponse,
  logError
};