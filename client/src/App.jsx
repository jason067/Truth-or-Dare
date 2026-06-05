import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import TruthOrDare from './pages/TruthOrDare';
import Spy from './pages/Spy';
import TurtleSoup from './pages/TurtleSoup';
import Casino from './pages/Casino';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/truth-or-dare" element={<TruthOrDare />} />
        <Route path="/spy" element={<Spy />} />
        <Route path="/turtle-soup" element={<TurtleSoup />} />
        <Route path="/casino" element={<Casino />} />
      </Routes>
    </Router>
  );
}
