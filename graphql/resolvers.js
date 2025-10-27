const ReservationService = require('../services/reservationService');
const {
    BadRequestError,
    UnauthorizedError,
    ValidationError,
    NotFoundError
} = require('../utils/errors');

// 验证用户认证
const requireAuth = (context) => {
    // 如果有认证错误，抛出带有错误代码的错误
    if (context.authError) {
        const error = new Error(context.authError.message);
        error.extensions = {
            code: context.authError.code,
            timestamp: new Date().toISOString()
        };
        throw error;
    }

    if (!context.user || !context.user._id) {
        const error = new Error('需要用户认证');
        error.extensions = {
            code: 'UNAUTHENTICATED',
            timestamp: new Date().toISOString()
        };
        throw error;
    }
    return context.user;
};

// 验证管理员权限
const requireAdmin = (context) => {
    const user = requireAuth(context);
    if (user.role !== 'admin') {
        const error = new Error('需要管理员权限');
        error.extensions = {
            code: 'PERMISSION_DENIED',
            timestamp: new Date().toISOString()
        };
        throw error;
    }
    return user;
};

// 验证预订时间
const validateArrivalTime = (arrivalTime) => {
    let arrival;
    if (arrivalTime instanceof Date) {
        arrival = arrivalTime;
    } else {
        arrival = new Date(arrivalTime);
    }
    
    if (isNaN(arrival.getTime())) {
        throw new ValidationError({ arrivalTime: '到达时间格式无效' });
    }
    
    if (arrival <= new Date()) {
        throw new ValidationError({ arrivalTime: '到达时间必须晚于当前时间' });
    }

    const hours = arrival.getHours();
    if (hours < 10 || hours >= 22) {
        throw new ValidationError({ arrivalTime: '请选择营业时间内的时间 (10:00-22:00)' });
    }
};

// 验证必填字段
const validateRequiredFields = (data, requiredFields) => {
    if (!data || typeof data !== 'object') {
        throw new BadRequestError('数据格式无效');
    }
    
    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
        const errors = {};
        missingFields.forEach(field => {
            errors[field] = '此字段为必填项';
        });
        throw new ValidationError(errors);
    }
};

// 格式化预订数据，确保时间字段为ISO字符串
const formatReservationData = (reservation) => {
    try {
        // 使用toJSON()而不是toObject()，这样可以保留虚拟字段和populated数据
        const formatted = reservation.toJSON ? reservation.toJSON() : reservation;
        
        // 安全地格式化日期字段
        const formatDateField = (value, fieldName) => {
            // 对于必需的日期字段，如果值为空，使用当前时间
            if (!value && (fieldName === 'arrivalTime' || fieldName === 'createdAt' || fieldName === 'updatedAt')) {
                console.warn(`Missing required date field ${fieldName}, using current time`);
                return new Date().toISOString();
            }
            
            if (!value) return value;
            
            try {
                let date;
                if (value instanceof Date) {
                    date = value;
                } else if (typeof value === 'string' && /^\d+$/.test(value)) {
                    // 时间戳字符串
                    date = new Date(parseInt(value));
                } else if (typeof value === 'string') {
                    // ISO字符串或其他格式
                    date = new Date(value);
                } else {
                    console.warn(`Invalid date format for ${fieldName}:`, value);
                    // 对于必需的日期字段，返回当前时间的ISO字符串
                    if (fieldName === 'arrivalTime' || fieldName === 'createdAt' || fieldName === 'updatedAt') {
                        return new Date().toISOString();
                    }
                    return value; // 对于可选字段，返回原值
                }
                
                // 检查日期是否有效
                if (isNaN(date.getTime())) {
                    console.error(`Invalid date value for ${fieldName}:`, value);
                    // 对于必需的日期字段，返回当前时间的ISO字符串
                    if (fieldName === 'arrivalTime' || fieldName === 'createdAt' || fieldName === 'updatedAt') {
                        return new Date().toISOString();
                    }
                    return value; // 对于可选字段，返回原值
                }
                
                return date.toISOString();
            } catch (error) {
                console.error(`Error formatting date field ${fieldName}:`, error, value);
                // 对于必需的日期字段，返回当前时间的ISO字符串
                if (fieldName === 'arrivalTime' || fieldName === 'createdAt' || fieldName === 'updatedAt') {
                    return new Date().toISOString();
                }
                return value; // 对于可选字段，返回原值
            }
        };
        
        // 格式化主要日期字段 - 确保这些字段不会为null
        formatted.arrivalTime = formatDateField(formatted.arrivalTime, 'arrivalTime');
        formatted.createdAt = formatDateField(formatted.createdAt, 'createdAt');
        formatted.updatedAt = formatDateField(formatted.updatedAt, 'updatedAt');
        
        // 处理状态历史中的时间和用户信息
        if (formatted.statusHistory && Array.isArray(formatted.statusHistory)) {
            formatted.statusHistory = formatted.statusHistory.map((history, index) => {
                const formattedHistory = { ...history };
                formattedHistory.changedAt = formatDateField(formattedHistory.changedAt, `statusHistory[${index}].changedAt`);
                
                // 处理 changedBy 字段：暂时设置为 null 以避免序列化错误
                // TODO: 实现正确的用户信息处理
                formattedHistory.changedBy = null;
                
                return formattedHistory;
            });
        }
        
        // 确保用户对象存在且有必需的字段
        if (formatted.user && typeof formatted.user === 'object') {
            // 确保用户ID存在
            if (!formatted.user.id && formatted.user._id) {
                formatted.user.id = formatted.user._id.toString();
            }
        }
        
        return formatted;
    } catch (error) {
        console.error('Error formatting reservation data:', error, reservation);
        // 如果格式化失败，返回原始数据
        return reservation.toJSON ? reservation.toJSON() : reservation;
    }
};

// 扁平的resolver结构（用于buildSchema）
const resolvers = {
    // 查询解析器
    getUserReservations: async (args, context) => {
        console.log('getUserReservations called');
        console.log('Context user:', context.user ? 'exists' : 'null');
        console.log('Context authError:', context.authError);

        try {
            const user = requireAuth(context);

            const options = {
                page: args.pagination?.page || 1,
                limit: args.pagination?.limit || 10,
                status: args.status,
                sortBy: args.sort?.sortBy || 'arrivalTime',
                sortOrder: args.sort?.sortOrder || 'desc'
            };

            // 验证分页参数
            if (options.page < 1) {
                throw new ValidationError({ page: '页码必须大于0' });
            }
            if (options.limit < 1 || options.limit > 100) {
                throw new ValidationError({ limit: '每页数量必须在1-100之间' });
            }

            const result = await ReservationService.getUserReservations(user._id, options);

            // 格式化预订数据，确保日期字段正确
            const formattedReservations = result.reservations.map(reservation => formatReservationData(reservation));

            return {
                reservations: formattedReservations,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages,
                    hasNextPage: result.hasNextPage,
                    hasPrevPage: result.hasPrevPage
                }
            };
        } catch (error) {
            // 如果是认证错误，直接抛出（保留extensions）
            if (error.extensions && (
                error.extensions.code === 'TOKEN_EXPIRED' ||
                error.extensions.code === 'TOKEN_INVALID' ||
                error.extensions.code === 'UNAUTHENTICATED' ||
                error.extensions.code === 'USER_NOT_FOUND'
            )) {
                throw error;
            }

            // 其他错误的处理
            if (error instanceof ValidationError) {
                throw new Error(`验证错误: ${JSON.stringify(error.details)}`);
            }
            if (error instanceof UnauthorizedError) {
                throw new Error(`权限错误: ${error.message}`);
            }
            if (error instanceof BadRequestError) {
                throw new Error(`请求错误: ${error.message}`);
            }
            if (error instanceof NotFoundError) {
                throw new Error(`资源未找到: ${error.message}`);
            }

            throw error;
        }
    },

    getAllReservations: async (args, context) => {
        try {
            requireAdmin(context);

            const filters = {
                status: args.filters?.status,
                userId: args.filters?.userId,
                searchTerm: args.filters?.searchTerm,
                startDate: args.filters?.startDate,
                endDate: args.filters?.endDate
            };

            // 过滤掉undefined值
            Object.keys(filters).forEach(key => {
                if (filters[key] === undefined) delete filters[key];
            });

            const options = {
                page: args.pagination?.page || 1,
                limit: args.pagination?.limit || 20,
                sortBy: args.sort?.sortBy || 'arrivalTime',
                sortOrder: args.sort?.sortOrder || 'desc'
            };

            // 验证分页参数
            if (options.page < 1) {
                throw new ValidationError({ page: '页码必须大于0' });
            }
            if (options.limit < 1 || options.limit > 100) {
                throw new ValidationError({ limit: '每页数量必须在1-100之间' });
            }

            const result = await ReservationService.getAllReservations(filters, options);

            // 格式化预订数据，确保日期字段正确
            const formattedReservations = result.reservations.map(reservation => formatReservationData(reservation));

            return {
                reservations: formattedReservations,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages,
                    hasNextPage: result.hasNextPage,
                    hasPrevPage: result.hasPrevPage
                }
            };
        } catch (error) {
            if (error.extensions) {
                throw error;
            }
            if (error instanceof ValidationError) {
                throw new Error(`验证错误: ${JSON.stringify(error.details)}`);
            }
            if (error instanceof UnauthorizedError) {
                throw new Error(`权限错误: ${error.message}`);
            }
            throw error;
        }
    },

    getReservationById: async (args, context) => {
        try {
            const user = requireAuth(context);

            if (!args.id) {
                throw new BadRequestError('预订ID不能为空');
            }

            const reservation = await ReservationService.getReservationById(args.id);

            // 检查权限：普通用户只能查看自己的预订，管理员可以查看所有预订
            if (user.role !== 'admin' && reservation.user._id.toString() !== user._id.toString()) {
                throw new UnauthorizedError('您只能查看自己的预订');
            }

            return formatReservationData(reservation);
        } catch (error) {
            if (error.extensions) {
                throw error;
            }
            if (error instanceof ValidationError) {
                throw new Error(`验证错误: ${JSON.stringify(error.details)}`);
            }
            if (error instanceof UnauthorizedError) {
                throw new Error(`权限错误: ${error.message}`);
            }
            if (error instanceof BadRequestError) {
                throw new Error(`请求错误: ${error.message}`);
            }
            if (error instanceof NotFoundError) {
                throw new Error(`资源未找到: ${error.message}`);
            }
            throw error;
        }
    },

    getTodayReservations: async (args, context) => {
        try {
            requireAdmin(context);
            const reservations = await ReservationService.getTodayReservations(args.status);
            return reservations.map(reservation => formatReservationData(reservation));
        } catch (error) {
            if (error.extensions) {
                throw error;
            }
            if (error instanceof UnauthorizedError) {
                throw new Error(`权限错误: ${error.message}`);
            }
            throw error;
        }
    },

    // 变更解析器
    createReservation: async (args, context) => {
        try {
            const user = requireAuth(context);
            
            const reservationData = {
                guestName: args.input.guestName,
                phoneNumber: args.input.phoneNumber,
                email: args.input.email,
                arrivalTime: new Date(args.input.arrivalTime),
                tableSize: args.input.tableSize,
                specialRequests: args.input.specialRequests,
                user: user._id
            };

            const reservation = await ReservationService.createReservation(reservationData);
            
            return {
                id: reservation._id.toString(),
                guestName: reservation.guestName,
                phoneNumber: reservation.phoneNumber,
                email: reservation.email,
                arrivalTime: reservation.arrivalTime.toISOString(),
                tableSize: reservation.tableSize,
                status: reservation.status,
                specialRequests: reservation.specialRequests || '',
                createdAt: reservation.createdAt.toISOString(),
                updatedAt: reservation.updatedAt.toISOString(),
                canEdit: true,
                canCancel: true,
                user: {
                    id: reservation.user._id.toString(),
                    username: reservation.user.username,
                    email: reservation.user.email,
                    role: reservation.user.role
                }
            };
        } catch (error) {
            throw new Error(error.message || '创建预订失败');
        }
    },

    updateReservation: async (args, context) => {
        try {
            const user = requireAuth(context);

            if (!args.id) {
                throw new BadRequestError('预订ID不能为空');
            }

            const updates = args.input;

            // 验证更新数据
            if (updates.arrivalTime) {
                validateArrivalTime(updates.arrivalTime);
            }

            const updatedReservation = await ReservationService.updateReservation(
                args.id,
                user._id,
                updates
            );

            return formatReservationData(updatedReservation);
        } catch (error) {
            if (error.extensions) {
                throw error;
            }
            if (error instanceof ValidationError) {
                throw new Error(`验证错误: ${JSON.stringify(error.details)}`);
            }
            if (error instanceof BadRequestError) {
                throw new Error(`请求错误: ${error.message}`);
            }
            throw error;
        }
    },

    updateReservationStatus: async (args, context) => {
        try {
            const user = requireAdmin(context);

            if (!args.id) {
                throw new BadRequestError('预订ID不能为空');
            }

            if (!args.status || !['Approved', 'Cancelled', 'Completed'].includes(args.status)) {
                throw new ValidationError({ status: '状态必须是Approved、Cancelled或Completed之一' });
            }

            if (args.status === 'Cancelled' && !args.reason) {
                throw new ValidationError({ reason: '取消预订必须提供原因' });
            }

            const changedBy = user._id;

            const updatedReservation = await ReservationService.updateReservationStatus(
                args.id,
                args.status,
                args.reason,
                changedBy
            );

            return {
                id: updatedReservation._id.toString(),
                guestName: updatedReservation.guestName,
                phoneNumber: updatedReservation.phoneNumber,
                email: updatedReservation.email,
                arrivalTime: updatedReservation.arrivalTime.toISOString(),
                tableSize: updatedReservation.tableSize,
                status: updatedReservation.status,
                specialRequests: updatedReservation.specialRequests || '',
                createdAt: updatedReservation.createdAt.toISOString(),
                updatedAt: updatedReservation.updatedAt.toISOString(),
                canEdit: updatedReservation.canEdit || false,
                canCancel: updatedReservation.canCancel || false,
                user: {
                    id: updatedReservation.user._id.toString(),
                    username: updatedReservation.user.username,
                    email: updatedReservation.user.email,
                    role: updatedReservation.user.role
                },
                statusHistory: updatedReservation.statusHistory ? updatedReservation.statusHistory.map(history => ({
                    status: history.status,
                    reason: history.reason || null,
                    changedAt: history.changedAt.toISOString(),
                    changedBy: null
                })) : []
            };
        } catch (error) {
            if (error.extensions) {
                throw error;
            }
            if (error instanceof ValidationError) {
                throw new Error(`验证错误: ${JSON.stringify(error.details)}`);
            }
            if (error instanceof BadRequestError) {
                throw new Error(`请求错误: ${error.message}`);
            }
            throw error;
        }
    },

    cancelReservation: async (args, context) => {
        try {
            const user = requireAuth(context);

            if (!args.id) {
                throw new BadRequestError('预订ID不能为空');
            }

            if (!args.reason || args.reason.trim() === '') {
                throw new ValidationError({ reason: '取消原因不能为空' });
            }

            const updatedReservation = await ReservationService.cancelReservation(
                args.id,
                user._id,
                args.reason
            );

            return formatReservationData(updatedReservation);
        } catch (error) {
            if (error.extensions) {
                throw error;
            }
            if (error instanceof ValidationError) {
                throw new Error(`验证错误: ${JSON.stringify(error.details)}`);
            }
            if (error instanceof BadRequestError) {
                throw new Error(`请求错误: ${error.message}`);
            }
            throw error;
        }
    }
};

module.exports = resolvers;