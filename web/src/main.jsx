import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Nav from "./components/Nav";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import JobPostingsPage from "./pages/JobPostingsPage";
import JobPostingDetailPage from "./pages/JobPostingDetailPage";
import CvPreviewPage from "./pages/CvPreviewPage";
import BillingPage from "./pages/BillingPage";
import "./styles/app.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Nav />
        <main className="main-content">
          <Routes>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<Navigate to="/job-postings" replace />} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/job-postings" element={<ProtectedRoute><JobPostingsPage /></ProtectedRoute>} />
            <Route path="/job-postings/:id" element={<ProtectedRoute><JobPostingDetailPage /></ProtectedRoute>} />
            <Route path="/job-postings/:postingId/cv/:cvId" element={<ProtectedRoute><CvPreviewPage /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
