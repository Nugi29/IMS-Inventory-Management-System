# IMS - Inventory Management System

A full-stack group project for inventory management, built with a Node.js + Express + Sequelize backend and a React + Vite frontend.

## 🚀 Project Overview

This repository includes:

- `backend/` — REST API server for inventory, customers, suppliers, purchase orders, GRN, sales, stock adjustments, stock movements, reports, and user authentication.
- `frontend/` — React dashboard application with charts, PDF export, routing, and inventory management UI.
- `database/` — MySQL schema and model resources.

## 🌐 Live Demo

- Backend API: https://ims-backend-server.vercel.app/
- Frontend App: https://ims-premium-inventory.vercel.app/

## 👥 Group Project

This project was developed by a team effort:

| Name | Role | GitHub |
|------|------|--------|
| **Nugitha Disas** | Full Stack Developer | [@Nugi29](https://github.com/Nugi29) |
| **Ishara Udayamali** | Full Stack Developer | [@isharaudayamali](https://github.com/isharaudayamali) |
| **Imasha Fernando** | Full Stack Developer | [@ImaFdo](https://github.com/ImaFdo) |

## 🛠️ Tech Stack

### Backend
- 🟩 Node.js
- ⚡ Express
- 🧩 Sequelize
- 🐬 MySQL
- 🔐 JSON Web Tokens
- 📧 Brevo API (Mail Service)

### Frontend
- ⚛️ React 19 with Vite 8
- 🛣️ React Router 7
- 🎨 Tailwind CSS 4
- 📡 Axios
- 🔔 React Toastify
- 📈 Recharts
- 🖨️ @react-pdf/renderer

### Hosting & Database
- ☁️ Vercel for deployment
- 💾 MySQL hosted on Railway

## ⚙️ Requirements

- Node.js 18+ and npm
- MySQL database credentials (Railway-hosted or local)
- Optional: Vercel account for deploys

## 🛠️ Setup Instructions

### Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/` with your Railway or local MySQL credentials, then run:

```bash
npm run start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Access the frontend at the Vite URL displayed in the terminal.

## 📝 Notes

- Backend entry point: `backend/server.js`
- Frontend entry point: `frontend/src/main.jsx`
- API base URL is configured in `frontend/src/services/httpClient.js`
- MySQL database is hosted on Railway for production
- Vercel configurations are available in `backend/vercel.json` and `frontend/vercel.json`

## 📌 Useful Local URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

---


