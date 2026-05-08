# Frontend - IMS Dashboard

This folder contains the React frontend application for the IMS Inventory Management System.

## 🎨 Overview

The frontend is built with React, Vite, Tailwind CSS, and Bootstrap. It delivers a modern admin dashboard for inventory, sales, purchase orders, suppliers, customers, stock movements, stock adjustments, and reports.

## 🛠️ Tech Stack

### Frontend
- ⚛️ React 19 with Vite 8
- 🛣️ React Router 7
- 🎨 Tailwind CSS 4
- 📡 Axios
- 🔔 React Toastify
- 📈 Recharts
- 🖨️ @react-pdf/renderer

### Hosting
- ☁️ Vercel for deployment

## 🌐 Live Demo

- https://ims-premium-inventory.vercel.app

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm

### Install Dependencies

```bash
cd frontend
npm install
```

### Run Locally

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

- `src/components/` — reusable UI components and forms
- `src/pages/` — application pages for dashboard, inventory, sales, supplier, user, and report screens
- `src/services/` — API client hooks and HTTP service utilities
- `src/context/` — global state and app context
- `src/assets/` — static images and icons

## 🔧 Notes

- API communication is handled in `src/services/httpClient.js`.
- Routing is powered by `react-router-dom`.
- Charts are rendered using `recharts`.
- Reports and printable exports use `@react-pdf/renderer`.
- Tailwind CSS is integrated via `@tailwindcss/vite`.
- Designed to work with the backend API deployed at `https://ims-backend-server.vercel.app/`.
