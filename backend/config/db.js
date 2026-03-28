const { Sequelize } = require('sequelize');
const initModels = require('../models/init-models');
require('dotenv').config();

const env = (key, fallback) => {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : fallback;
};

const sequelize = new Sequelize(
  env('DB_NAME', 'ims'),
  env('DB_USER', 'root'),
  env('DB_PASSWORD', ''),
  {
    host: env('DB_HOST', 'localhost'),
    dialect: env('DB_DIALECT', 'mysql'),
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
    throw error;
  }
};

module.exports = {
  sequelize,
  models,
  connectDB,
};