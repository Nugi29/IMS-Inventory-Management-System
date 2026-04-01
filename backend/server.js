const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { connectDB } = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const lookupRoutes = require('./routes/LookupRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/user', userRoutes);
app.use('/api/list', lookupRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

