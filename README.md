# Valorant Utilities Web App

This is a full-stack web application built with React (Vite) and Node.js (Express).

## Prerequisites
- Node.js installed on your machine.

## How to Run Manually

Since this app consists of a Backend server and a Frontend application, you will need to open **two separate terminal windows** (or command prompts) to run them both simultaneously.

### 1. Start the Backend Server
Open your first terminal and run the following commands:
```powershell
cd c:\webappvalorantutils\backend
node server.js
```
*You should see a message saying "Server running on http://localhost:3001". Keep this terminal open!*

### 2. Start the Frontend App
Open a **second** terminal and run the following commands:
```powershell
cd c:\webappvalorantutils\frontend
npm run dev
```
*You should see a message indicating the server is ready (e.g., "http://localhost:5173/").*

### 3. Open the App
Once both servers are running, open your web browser and navigate to:
[http://localhost:5173](http://localhost:5173)

---

## Modifying Data
To add new agents or change existing ones, you can edit the `c:\webappvalorantutils\backend\data\agents.json` file. The frontend will automatically load any changes when you refresh the page.
