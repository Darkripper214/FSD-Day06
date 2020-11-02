const express = require('express');
const hbs = require('express-handlebars');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'playstore',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
  timezone: '+08:00',
});

const SQL_FIND_BY_NAME =
  'select * from apps where name like ? limit ? offset ?';

// Ping the pool
const startApp = async (app, pool) => {
  try {
    // Get a connection from the connection pool
    const conn = await pool.getConnection();
    console.info('Ping-ing database');
    conn.ping();

    app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
    // Realease the connection
    await conn.release;
  } catch (err) {
    console.error('Cannot ping database:', err);
  }
};

let PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 4567;
const app = express();
app.engine(
  'hbs',
  hbs({
    defaultLayout: 'default.hbs',
    helpers: {
      // Function to do basic mathematical operation in handlebar
      math: function (lvalue, operator, rvalue) {
        lvalue = parseFloat(lvalue);
        rvalue = parseFloat(rvalue);
        return {
          '+': lvalue + rvalue,
          '-': lvalue - rvalue,
          '*': lvalue * rvalue,
          '/': lvalue / rvalue,
          '%': lvalue % rvalue,
        }[operator];
      },
    },
  })
);
app.set('view engine', 'hbs');

app.get('/search', async (req, res) => {
  let offset, previousPageState;
  let nextPageState = false;
  if (parseInt(req.query.offset) < 0) {
    offset = 0;
  } else {
    offset = parseInt(req.query.offset);
  }
  /* let offset = parseInt(req.query.offset) || 0; */
  if (offset === 0) {
    previousPageState = false;
  } else {
    previousPageState = true;
  }

  const q = req.query.q;
  let limit = 11;
  const conn = await pool.getConnection();
  try {
    const results = await conn.query(SQL_FIND_BY_NAME, [
      `%${q}%`,
      limit,
      offset,
    ]);
    result = results[0];
  } catch (err) {
    console.log(err);
  } finally {
    // Release connection
    await conn.release();
  }

  // If length > 10. show next button and removed the item 11
  if (result.length > 10) {
    nextPageState = true;
    result.pop();
  }

  res.status(200);
  res.type('text/html');
  res.render('search', {
    result,
    offset,
    q,
    previousPageState,
    nextPageState,
    resultLength: result.length,
  });
});

app.get('/', (req, res) => {
  res.status(200);
  res.type('text/html');
  res.render('landing');
});

startApp(app, pool);
