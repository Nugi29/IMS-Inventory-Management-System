# Backend - IMS API

This folder contains the backend REST API server for the IMS Inventory Management System.

## 🚀 Overview

The backend is built with Node.js, Express, Sequelize, and MySQL. It powers the inventory dashboard, customer management, supplier workflows, purchase orders, GRN, sales, stock movements, stock adjustments, reports, and user authentication.

## 🧩 Group Project Context

This backend is part of a group project with shared development between frontend and backend team members. The database is hosted on Railway for production.

## 🛠️ Tech Stack

### Backend
- 🟩 Node.js
- ⚡ Express
- 🧩 Sequelize
- 🐬 MySQL
- 🔐 JSON Web Tokens

### Hosting & Database
- ☁️ Vercel for deployment
- 💾 MySQL hosted on Railway

## ✅ Getting Started

### Prerequisites

- Node.js 18+ and npm
- MySQL database credentials (Railway-hosted recommended)

### Install Dependencies

```bash
cd backend
npm install
```

### Run the Server

```bash
npm run start
```

The server starts with `nodemon` and picks up configuration from your `.env` file.

## 📁 Main Files and Folders

- `server.js` — main application entry point
- `config/db.js` — database connection setup
- `controllers/` — business logic for each module
- `models/` — Sequelize model definitions
- `routes/` — API route definitions
- `middlewares/` — authentication and request middleware
- `utils/` — helper utilities

## 🔐 Environment Variables

Create a `.env` file in `backend/` and configure:

- `DB_HOST` — Railway host or local host
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `PORT`
- `DB_MODE`
- `BREVO_API_KEY` — API key for Brevo (formerly Sendinblue)
- `BREVO_SENDER_EMAIL` — The email address used as the sender

## ☁️ Deployment

The backend includes a Vercel configuration at `backend/vercel.json` for production deployment.

## 📧 Mail Service

The system integrates with **Brevo (v3 API)** to send automated email notifications:

- **Purchase Orders:** Automatically sends a PDF or summary to the supplier when a new PO is created (if selected).
- **Goods Received Notes (GRN):** Allows users to send GRN receipts/invoices directly to suppliers from the management dashboard.


## 🌐 Live Demo

- https://ims-backend-server.vercel.app

## 💡 Notes

- Uses Sequelize for database modeling and ORM.
- Uses JWT for authentication.
- Designed to integrate with the frontend at `../frontend`.
- Uses Railway-hosted MySQL for production database access.
