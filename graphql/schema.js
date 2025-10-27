const { buildSchema } = require('graphql');

const schema = buildSchema(`
  # 预订状态枚举
  enum ReservationStatus {
    Requested
    Approved
    Cancelled
    Completed
  }

  # 用户类型
  type User {
    id: ID!
    username: String!
    email: String!
    role: String!
  }

  # 状态历史记录
  type StatusHistory {
    status: ReservationStatus!
    reason: String
    changedAt: String!
    changedBy: String
  }

  # 预订类型
  type Reservation {
    id: ID!
    user: User!
    guestName: String!
    phoneNumber: String!
    email: String!
    arrivalTime: String!
    tableSize: Int!
    status: ReservationStatus!
    specialRequests: String
    statusHistory: [StatusHistory!]!
    createdAt: String!
    updatedAt: String!
    formattedArrivalTime: String
    canEdit: Boolean!
    canCancel: Boolean!
  }

  # 分页信息
  type PaginationInfo {
    page: Int!
    limit: Int!
    total: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
  }

  # 分页预订结果
  type PaginatedReservations {
    reservations: [Reservation!]!
    pagination: PaginationInfo!
  }

  # 预订输入类型
  input ReservationInput {
    guestName: String!
    phoneNumber: String!
    email: String!
    arrivalTime: String!
    tableSize: Int!
    specialRequests: String
  }

  # 预订更新输入类型
  input ReservationUpdateInput {
    guestName: String
    phoneNumber: String
    email: String
    arrivalTime: String
    tableSize: Int
    specialRequests: String
  }

  # 预订筛选输入类型
  input ReservationFilters {
    status: ReservationStatus
    userId: ID
    searchTerm: String
    startDate: String
    endDate: String
  }

  # 排序选项
  input SortOptions {
    sortBy: String
    sortOrder: String
  }

  # 分页选项
  input PaginationOptions {
    page: Int
    limit: Int
  }

  # 查询类型
  type Query {
    # 获取用户的预订列表
    getUserReservations(
      pagination: PaginationOptions
      sort: SortOptions
      status: ReservationStatus
    ): PaginatedReservations!

    # 获取所有预订列表（管理员使用）
    getAllReservations(
      filters: ReservationFilters
      pagination: PaginationOptions
      sort: SortOptions
    ): PaginatedReservations!

    # 根据ID获取预订详情
    getReservationById(id: ID!): Reservation!

    # 获取今日预订
    getTodayReservations(status: ReservationStatus): [Reservation!]!
  }

  # 变更类型
  type Mutation {
    # 创建预订
    createReservation(input: ReservationInput!): Reservation!

    # 更新预订信息
    updateReservation(id: ID!, input: ReservationUpdateInput!): Reservation!

    # 更新预订状态（管理员使用）
    updateReservationStatus(id: ID!, status: ReservationStatus!, reason: String): Reservation!

    # 取消预订
    cancelReservation(id: ID!, reason: String!): Reservation!
  }

  # 订阅类型（可选，用于实时更新）
  type Subscription {
    # 预订状态变更通知
    reservationStatusChanged(userId: ID): Reservation!
    
    # 新预订通知（管理员）
    newReservationCreated: Reservation!
  }
`);

module.exports = schema;