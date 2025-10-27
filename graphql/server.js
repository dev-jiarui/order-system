const { createHandler } = require('graphql-http/lib/use/express');
const schema = require('./schema');
const resolvers = require('./resolvers');
const { createContext } = require('./context');

/**
 * 创建GraphQL服务器中间件
 */
const createGraphQLServer = () => {
  return createHandler({
    schema,
    rootValue: resolvers,
    context: async (req) => {
      // 创建上下文
      return await createContext({ req });
    },
    formatError: (error) => {
      // 自定义错误格式
      console.error('GraphQL Error:', error);
      
      return {
        message: error.message,
        locations: error.locations,
        path: error.path,
        extensions: {
          code: error.extensions?.code || 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        }
      };
    }
  });
};

module.exports = { createGraphQLServer };