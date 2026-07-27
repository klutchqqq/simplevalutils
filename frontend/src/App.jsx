import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Draft from './pages/Draft';
import FunMode from './pages/FunMode';
import Tournament from './pages/Tournament';
import MapVeto from './pages/MapVeto';
import { LanguageProvider } from './context/LanguageContext';

function App() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <LanguageProvider>
      <Router>
        <div className="App">
          <Navbar />
          <main className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/draft" element={<Draft />} />
              <Route path="/funmode" element={<FunMode />} />
              <Route path="/tournament" element={<Tournament />} />
              <Route path="/mapveto" element={<MapVeto />} />
            </Routes>
          </main>
        </div>
      </Router>
    </LanguageProvider>
  );
}

export default App;
