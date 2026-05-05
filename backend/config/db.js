const { Sequelize } = require('sequelize');
const initModels = require('../models/init-models');
require('dotenv').config();

const env = (key, fallback) => {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : fallback;
};

const isRemote = env('DB_MODE', 'local') === 'remote';

const sequelize = new Sequelize(
  isRemote
    ? env('REMOTE_DB_NAME')
    : env('LOCAL_DB_NAME', 'ims'),
  isRemote
    ? env('REMOTE_DB_USER')
    : env('LOCAL_DB_USER', 'root'),
  isRemote
    ? env('REMOTE_DB_PASSWORD')
    : env('LOCAL_DB_PASSWORD', ''),
  {
    host: isRemote
      ? env('REMOTE_DB_HOST')
      : env('LOCAL_DB_HOST', 'localhost'),
    port: isRemote
      ? env('REMOTE_DB_PORT', env('MYSQLPORT'))
      : env('LOCAL_DB_PORT', 3306),
    dialect: env('DB_DIALECT', 'mysql'),
    logging: false,
  }
);

const models = initModels(sequelize);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`MySQL connected (${isRemote ? 'Remote/Railway' : 'Local'})`);
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