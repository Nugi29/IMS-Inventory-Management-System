const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { connectDB } = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const lookupRoutes = require('./routes/LookupRoutes');
const customerRoutes = require('./routes/customerRoutes');
const salesRoutes = require('./routes/salesRoutes');
const purchaseOrderRoutes = require('./routes/PurchaseOrderRoutes');
const grnRoutes = require('./routes/grnRoutes');
const stockMovementRoutes = require('./routes/stockMovementRoutes');
const stockAdjustmentRoutes = require('./routes/stockAdjustmentRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const itemRoutes = require('./routes/itemRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportsRoutes = require('./routes/reportRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/user', userRoutes);
app.use('/api/list', lookupRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/po', purchaseOrderRoutes);
app.use('/api/grns', grnRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/supplier', supplierRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);

app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/stock-adjustments', stockAdjustmentRoutes);


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

