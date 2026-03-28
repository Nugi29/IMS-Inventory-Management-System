const { Sequelize } = require('sequelize');
const initModels = require('../models/init-models');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ims',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '1234',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false,
  }
);

const models = initModels(sequelize);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL connected');
  } catch (error) {
    console.error('MySQL connection error:', error.message);
  }
};

module.exports = {
  sequelize,
  models,
  connectDB,
};