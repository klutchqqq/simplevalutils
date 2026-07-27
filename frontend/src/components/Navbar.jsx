import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Dices, Trophy, Map, Home, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Navbar = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 2rem',
      backgroundColor: 'var(--secondary-color)',
      borderBottom: '1px solid var(--border-color)'
    }}>
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontWeight: 700, letterSpacing: '1px' }}>VAL UTILS</h2>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Home size={18} /> {t('nav.home')}
          </Link>
          <Link to="/draft" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} /> {t('nav.draft')}
          </Link>
          <Link to="/funmode" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Dices size={18} /> {t('nav.fun')}
          </Link>
          <Link to="/tournament" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={18} /> {t('nav.tournament')}
          </Link>
          <Link to="/mapveto" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Map size={18} /> {t('nav.mapveto')}
          </Link>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Globe size={18} color="var(--text-color)" />
        <select 
          value={language} 
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            padding: '4px 8px',
            backgroundColor: 'var(--bg-color)',
            color: 'var(--text-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          <option value="en">English</option>
          <option value="vi">Ti?ng Vi?t</option>
        </select>
      </div>
    </nav>
  );
};

export default Navbar;
