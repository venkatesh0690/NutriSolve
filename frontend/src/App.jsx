import React, { useState } from 'react';
import Header from './components/Header';
import DietPlanPage from './pages/DietPlanPage';
import DailyTrackerPage from './pages/DailyTrackerPage';
import MonthlyTrackerPage from './pages/MonthlyTrackerPage';
import ProfilePage from './pages/ProfilePage';
import './App.css';

export default function App() {
  const [currentTab, setCurrentTab] = useState('diet-plan');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'diet-plan':
        return <DietPlanPage onPlanSubmit={triggerRefresh} />;
      case 'tracker':
        return <DailyTrackerPage onLogSubmit={triggerRefresh} />;
      case 'monthly':
        return <MonthlyTrackerPage />;
      case 'profile':
        return <ProfilePage onProfileSave={triggerRefresh} />;
      default:
        return <DietPlanPage onPlanSubmit={triggerRefresh} />;
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col">
      <Header 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        refreshTrigger={refreshTrigger} 
      />
      <main className="flex-1 w-full max-w-7xl mx-auto py-4">
        {renderContent()}
      </main>
      <footer className="py-6 border-t border-dark-border text-center text-xs text-slate-500 bg-slate-950/40">
        <p>&copy; {new Date().getFullYear()} NutriSolve. All rights reserved.</p>
        <p className="mt-1 text-[10px] text-slate-600">Built using React + Tailwind CSS v4 &amp; FastAPI + SQLite</p>
      </footer>
    </div>
  );
}
