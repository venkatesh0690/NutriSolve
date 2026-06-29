import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DietPlanPage from './pages/DietPlanPage';
import DailyTrackerPage from './pages/DailyTrackerPage';
import MonthlyTrackerPage from './pages/MonthlyTrackerPage';
import ProfilePage from './pages/ProfilePage';
import AuthModal from './components/AuthModal';
import './App.css';

export default function App() {
  const [currentTab, setCurrentTab] = useState('diet-plan');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('nutrisolve_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    triggerRefresh();
  };

  const handleLogout = () => {
    localStorage.removeItem('nutrisolve_user');
    setCurrentUser(null);
    triggerRefresh();
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'diet-plan':
        return <DietPlanPage onPlanSubmit={triggerRefresh} currentUser={currentUser} />;
      case 'tracker':
        return <DailyTrackerPage onLogSubmit={triggerRefresh} currentUser={currentUser} />;
      case 'monthly':
        return <MonthlyTrackerPage currentUser={currentUser} />;
      case 'profile':
        return <ProfilePage onProfileSave={triggerRefresh} currentUser={currentUser} />;
      default:
        return <DietPlanPage onPlanSubmit={triggerRefresh} currentUser={currentUser} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-[#050e14] text-slate-100 overflow-x-hidden">
      {/* FlowPro Glowing Wave Background Graphic directly matching attached reference image */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-teal-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-10 w-[600px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />

        {/* Sweeping glowing cyan/teal waves matching FlowPro image */}
        <svg className="absolute w-full h-full min-w-[1400px] opacity-80" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="flowWave1" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="flowWave2" x1="0%" y1="30%" x2="100%" y2="70%">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="16" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Glowing ribbon fill */}
          <path
            d="M-100 780 C 300 880, 600 480, 1000 680 C 1250 800, 1450 620, 1600 520 L 1600 950 L -100 950 Z"
            fill="url(#flowWave1)"
            opacity="0.22"
          />
          {/* Main glowing light trail */}
          <path
            d="M-100 750 C 320 830, 580 430, 1020 650 C 1220 750, 1420 600, 1600 500"
            stroke="url(#flowWave1)"
            strokeWidth="28"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          <path
            d="M-100 750 C 320 830, 580 430, 1020 650 C 1220 750, 1420 600, 1600 500"
            stroke="#2dd4bf"
            strokeWidth="7"
            strokeLinecap="round"
          />

          {/* Secondary criss-crossing thin light trails */}
          <path
            d="M-100 480 C 250 330, 700 680, 1200 380 C 1380 270, 1500 330, 1600 310"
            stroke="url(#flowWave2)"
            strokeWidth="10"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          <path
            d="M-100 480 C 250 330, 700 680, 1200 380 C 1380 270, 1500 330, 1600 310"
            stroke="#06b6d4"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header 
          currentTab={currentTab} 
          setCurrentTab={setCurrentTab} 
          refreshTrigger={refreshTrigger} 
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
          onLogout={handleLogout}
        />
        <main className="flex-1 w-full max-w-7xl mx-auto py-4 px-4">
          {renderContent()}
        </main>
        <footer className="py-6 border-t border-white/10 text-center text-xs text-slate-400 bg-slate-950/60 backdrop-blur-md">
          <p>&copy; {new Date().getFullYear()} NutriSolve. All rights reserved.</p>
          <p className="mt-1 text-[10px] text-slate-500">Built using React + Tailwind CSS &amp; FastAPI</p>
        </footer>
      </div>

      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onAuthSuccess={handleAuthSuccess} 
      />
    </div>
  );
}
