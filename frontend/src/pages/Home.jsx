import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Dices, Trophy, Map } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Home = () => {
  const { t } = useLanguage();

  return (
    <div style={{ textAlign: 'center', marginTop: '4rem' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>{t('home.title')}</h1>
      <p style={{ fontSize: '1.2rem', color: 'var(--accent-color)', marginBottom: '3rem' }}>
        {t('home.subtitle')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
        
        <Link to="/draft" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', transition: 'transform 0.2s' }}>
          <Shield size={48} color="var(--text-color)" />
          <h2>{t('nav.draft')}</h2>
          <p style={{ color: 'var(--accent-color)', textAlign: 'center' }}>
            {t('home.draft.desc')}
          </p>
        </Link>

        <Link to="/funmode" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', transition: 'transform 0.2s' }}>
          <Dices size={48} color="var(--text-color)" />
          <h2>{t('nav.fun')}</h2>
          <p style={{ color: 'var(--accent-color)', textAlign: 'center' }}>
            {t('home.fun.desc')}
          </p>
        </Link>

        <Link to="/tournament" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', transition: 'transform 0.2s' }}>
          <Trophy size={48} color="var(--text-color)" />
          <h2>{t('nav.tournament')}</h2>
          <p style={{ color: 'var(--accent-color)', textAlign: 'center' }}>
            {t('home.tournament.desc')}
          </p>
        </Link>

        <Link to="/mapveto" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', transition: 'transform 0.2s' }}>
          <Map size={48} color="var(--text-color)" />
          <h2>{t('nav.mapveto')}</h2>
          <p style={{ color: 'var(--accent-color)', textAlign: 'center' }}>
            {t('home.mapveto.desc')}
          </p>
        </Link>

      </div>
    </div>
  );
};

export default Home;
