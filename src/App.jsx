import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";
import FileManagement from "./pages/FileManagement.jsx";
import CreateFile from "./pages/CreateFile.jsx";
import SoldierProfile from "./pages/SoldierProfile.jsx";
import HistoryReports from "./pages/HistoryReports.jsx";
import SendMessage from "./pages/SendMessage.jsx";
import AIChat from "./pages/AIChat.jsx";
import Settings from "./pages/Settings.jsx";
import Help from "./pages/Help.jsx";
import Schedule from "./pages/Schedule.jsx";
import Messages from "./pages/Messages.jsx";

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={currentUser ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/" element={<PrivateRoute><AppLayout><Home /></AppLayout></PrivateRoute>} />
      <Route path="/schedule" element={<PrivateRoute><AppLayout><Schedule /></AppLayout></PrivateRoute>} />
      <Route path="/files" element={<PrivateRoute><AppLayout><FileManagement /></AppLayout></PrivateRoute>} />
      <Route path="/files/new" element={<PrivateRoute><AppLayout><CreateFile /></AppLayout></PrivateRoute>} />
      <Route path="/soldier/:soldierId" element={<PrivateRoute><AppLayout><SoldierProfile /></AppLayout></PrivateRoute>} />
      <Route path="/history" element={<PrivateRoute><AppLayout><HistoryReports /></AppLayout></PrivateRoute>} />
      <Route path="/send-message" element={<PrivateRoute><AppLayout><SendMessage /></AppLayout></PrivateRoute>} />
      <Route path="/messages" element={<PrivateRoute><AppLayout><Messages /></AppLayout></PrivateRoute>} />
      <Route path="/ai-chat" element={<PrivateRoute><AppLayout><AIChat /></AppLayout></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><AppLayout><Settings /></AppLayout></PrivateRoute>} />
      <Route path="/help" element={<PrivateRoute><AppLayout><Help /></AppLayout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
