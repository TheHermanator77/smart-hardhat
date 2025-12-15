const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: "student-databases.cvode4s4cwrc.us-west-2.rds.amazonaws.com",
  user: "kyleherman",
  password: 'CQnB2CQREOWABG8rLO5bJYt8DvgPQgrILwZ',
  database: "kyleherman",
  port: 3306,

  charset: "utf8mb4",

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
