import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import TruthOrDare from './pages/TruthOrDare';
import Spy from './pages/Spy';
import TurtleSoup from './pages/TurtleSoup';
import Casino from './pages/Casino';

// 從環境變數讀取 Google Client ID，如果沒有則使用假 ID 避免畫面崩潰
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'mock-client-id-please-replace-me';

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/truth-or-dare" element={<TruthOrDare />} />
            <Route path="/spy" element={<Spy />} />
            <Route path="/turtle-soup" element={<TurtleSoup />} />
            <Route path="/casino" element={<Casino />} />
          </Routes>
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
