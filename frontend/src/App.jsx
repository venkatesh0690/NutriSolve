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
  const [theme, setTheme] = useState(localStorage.getItem('nutrisolve_theme') || 'light');

  useEffect(() => {
    const savedUser = localStorage.getItem('nutrisolve_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nutrisolve_theme', theme);
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

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
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      <Header 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        refreshTrigger={refreshTrigger} 
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="flex-1 w-full max-w-7xl mx-auto py-4 px-4">
        {renderContent()}
      </main>
      <footer className="py-6 border-t border-dark-border text-center text-xs text-slate-500 bg-slate-950/40">
        <p>&copy; {new Date().getFullYear()} NutriSolve. All rights reserved.</p>
        <p className="mt-1 text-[10px] text-slate-600">Built using React + Tailwind CSS &amp; FastAPI</p>
      </footer>

      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onAuthSuccess={handleAuthSuccess} 
      />
    </div>
  );
}
