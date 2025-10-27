const express = require('express');
const { createGraphQLServer } = require('../graphql/server');

const router = express.Router();

// GraphQL端点
router.use('/graphql', createGraphQLServer());

// GraphQL Playground（开发环境）
if (process.env.NODE_ENV === 'dev') {
  router.get('/playground', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>GraphQL Playground</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
      </head>
      <body>
        <div id="root">
          <style>
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
                'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
                sans-serif;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            
            code {
              font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
                monospace;
            }
            
            #root {
              height: 100vh;
            }
          </style>
          <div style="height: 100vh; display: flex; align-items: center; justify-content: center;">
            <div style="text-align: center;">
              <h1>GraphQL Playground</h1>
              <p>访问 <a href="/api/graphql" target="_blank">/api/graphql</a> 使用GraphiQL</p>
              <p>或使用以下查询示例：</p>
              <pre style="text-align: left; background: #f5f5f5; padding: 1rem; border-radius: 4px;">
query GetUserReservations {
  getUserReservations(
    pagination: { page: 1, limit: 10 }
    sort: { sortBy: "arrivalTime", sortOrder: "desc" }
  ) {
    reservations {
      id
      guestName
      arrivalTime
      status
      tableSize
    }
    pagination {
      total
      totalPages
      hasNextPage
    }
  }
}
              </pre>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  });
}

module.exports = router;