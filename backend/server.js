const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { connectDB } = require('./config/db');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/user', userRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 3000;

connectDB();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/`);
});

