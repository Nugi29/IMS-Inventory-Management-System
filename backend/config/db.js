import { Sequelize } from 'sequelize';

// Create sequelize instance
export const sequelize = new Sequelize(
  'ims',       // database name
  'root',       // username
  '1234',   // password
  {
    host: 'localhost',
    dialect: 'mysql',
    logging: false, // Disable SQL logs
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    
    // Initialize models after connection is established
    const { initializeModels } = await import('../models');
    initializeModels();
    
    console.log('✅ MySQL connected!');
  } catch (error) {
    console.error('❌ MySQL connection error:', error);
  }
};