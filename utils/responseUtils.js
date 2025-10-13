/**
 * 统一响应格式工具类
 * 用于标准化API响应格式，支持华为云FunctionGraph和Express.js
 */

/**
 * 成功响应格式
 * @param {*} data - 响应数据
 * @param {string} message - 响应消息
 * @param {number} total - 总数（可选，用于分页）
 * @param {*} info - 额外信息（可选）
 * @returns {Object} 格式化的响应对象
 */
function formatOutputSuccess(data = null, message = 'success', total, info = null) {
  const responseBody = {
    code: 0,
    message: message,
    data: data,
  };

  // 如果 total 被传入，就添加 total 字段
  if (total !== undefined) {
    responseBody.total = total;
  }

  if (info) {
    responseBody.info = info;
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    isBase64Encoded: false,
    body: JSON.stringify(responseBody),
  };
}

/**
 * 带自定义业务码的成功响应
 * @param {*} data - 响应数据
 * @param {string} message - 响应消息
 * @param {number} code - 业务状态码
 * @returns {Object} 格式化的响应对象
 */
function formatOutputSuccessWithCode(data = null, message = 'success', code = 0) {
  const responseBody = {
    code: code,
    message: message,
    data: data,
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    isBase64Encoded: false,
    body: JSON.stringify(responseBody),
  };
}

/**
 * 失败响应格式
 * @param {number} statusCode - HTTP状态码
 * @param {string} message - 错误消息
 * @param {number} bizCode - 业务错误码
 * @returns {Object} 格式化的错误响应对象
 */
function formatOutputFailed(statusCode = 500, message = 'internal server error', bizCode = -1) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    isBase64Encoded: false,
    body: JSON.stringify({
      code: bizCode,
      message: message
    })
  };
}

/**
 * Express.js 响应辅助函数
 * 将格式化的响应发送给Express.js的res对象
 * @param {Object} res - Express响应对象
 * @param {Object} formattedResponse - 格式化的响应对象
 */
function sendResponse(res, formattedResponse) {
  const { statusCode, headers, body } = formattedResponse;
  
  // 设置响应头
  Object.keys(headers).forEach(key => {
    res.setHeader(key, headers[key]);
  });
  
  // 发送响应 - 解析JSON字符串为对象
  res.status(statusCode).json(JSON.parse(body));
}

/**
 * Express.js 成功响应快捷方法
 * @param {Object} res - Express响应对象
 * @param {*} data - 响应数据
 * @param {string} message - 响应消息
 * @param {number} total - 总数（可选）
 * @param {*} info - 额外信息（可选）
 */
function sendSuccess(res, data = null, message = 'success', total, info = null) {
  const response = formatOutputSuccess(data, message, total, info);
  sendResponse(res, response);
}

/**
 * Express.js 失败响应快捷方法
 * @param {Object} res - Express响应对象
 * @param {number} statusCode - HTTP状态码
 * @param {string} message - 错误消息
 * @param {number} bizCode - 业务错误码
 */
function sendError(res, statusCode = 500, message = 'internal server error', bizCode = -1) {
  const response = formatOutputFailed(statusCode, message, bizCode);
  sendResponse(res, response);
}

module.exports = {
  formatOutputSuccess,
  formatOutputSuccessWithCode,
  formatOutputFailed,
  sendResponse,
  sendSuccess,
  sendError
};