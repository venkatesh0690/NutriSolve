import React, { useEffect, useState } from 'react';
import { Activity, User, BookOpen, Utensils, RefreshCw, Calendar, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { API_BASE } from '../config';

export default function Header({ currentTab, setCurrentTab, refreshTrigger, currentUser, onOpenAuth, onLogout }) {
  const [metrics, setMetrics] = useState({
    daily_healthy_pct: 0,
    weekly_healthy_pct: 0,
    today_calories: 0
  });
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const d = new Date();
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const ts = Date.now();
      const headers = {};
      if (currentUser && currentUser.id) {
        headers['X-User-ID'] = String(currentUser.id);
      }
      const res = await fetch(`${API_BASE}/api/analytics?local_date=${localDateStr}&_t=${ts}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [refreshTrigger, currentTab, currentUser]);

  const getProgressColor = (pct) => {
    if (pct >= 80) return 'text-emerald-400 stroke-emerald-400';
    if (pct >= 50) return 'text-amber-400 stroke-amber-400';
    return 'text-rose-400 stroke-rose-400';
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-dark-border bg-dark-bg/85 backdrop-blur-md px-4 sm:px-6 py-4 shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Logo and User account controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 border border-brand-primary/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Activity className="h-5 w-5 text-brand-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white m-0">NutriSolve</h1>
              <p className="text-xs text-slate-400">Diet & Intake Optimization</p>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-dark-border text-xs text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-bold max-w-[80px] truncate">{currentUser.name}</span>
                <button onClick={onLogout} title="Log Out" className="text-slate-400 hover:text-rose-400 ml-1">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={onOpenAuth} className="flex items-center gap-1 bg-brand-primary text-black text-xs font-bold px-3 py-1.5 rounded-lg shadow">
                <LogIn className="h-3.5 w-3.5" /> Login
              </button>
            )}
            <button 
              onClick={fetchMetrics} 
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Refresh metrics"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Healthy Consumption Metrics */}
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 bg-slate-900/60 p-2.5 rounded-2xl border border-dark-border">
          {/* Daily Tracker Ring */}
          <div className="flex items-center gap-3 px-2 sm:px-3 py-1 border-r border-dark-border/60 last:border-0">
            <div className="relative flex h-11 w-11 items-center justify-center">
              <svg className="absolute top-0 left-0 h-full w-full -rotate-90">
                <circle cx="22" cy="22" r="18" className="stroke-slate-800 fill-none" strokeWidth="3.5" />
                <circle
                  cx="22" cy="22" r="18"
                  className={`fill-none transition-all duration-700 ${getProgressColor(metrics.daily_healthy_pct)}`}
                  strokeWidth="3.5"
                  strokeDasharray={2 * Math.PI * 18}
                  strokeDashoffset={2 * Math.PI * 18 * (1 - metrics.daily_healthy_pct / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[10px] font-bold text-white">{metrics.daily_healthy_pct}%</span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Daily Calorie</div>
              <div className="text-xs font-semibold text-slate-200">Compliance</div>
            </div>
          </div>

          {/* Weekly Tracker Ring */}
          <div className="flex items-center gap-3 px-2 sm:px-3 py-1 border-r border-dark-border/60 last:border-0">
            <div className="relative flex h-11 w-11 items-center justify-center">
              <svg className="absolute top-0 left-0 h-full w-full -rotate-90">
                <circle cx="22" cy="22" r="18" className="stroke-slate-800 fill-none" strokeWidth="3.5" />
                <circle
                  cx="22" cy="22" r="18"
                  className={`fill-none transition-all duration-700 ${getProgressColor(metrics.weekly_healthy_pct)}`}
                  strokeWidth="3.5"
                  strokeDasharray={2 * Math.PI * 18}
                  strokeDashoffset={2 * Math.PI * 18 * (1 - metrics.weekly_healthy_pct / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[10px] font-bold text-white">{metrics.weekly_healthy_pct}%</span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Weekly Calorie</div>
              <div className="text-xs font-semibold text-slate-200">7-Day Avg</div>
            </div>
          </div>

          {/* Today Calories Indicator */}
          <div className="flex items-center gap-2 px-3 py-1 hidden sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
              <Utensils className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Today's Intake</div>
              <div className="text-xs font-bold text-orange-400">{metrics.today_calories} kcal</div>
            </div>
          </div>

          <button 
            onClick={fetchMetrics} 
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition hidden lg:block"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Navigation & Desktop User Account Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-xl border border-dark-border">
            <button
              onClick={() => setCurrentTab('diet-plan')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                currentTab === 'diet-plan'
                  ? 'bg-brand-primary text-black font-bold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Diet Plan
            </button>
            
            <button
              onClick={() => setCurrentTab('tracker')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                currentTab === 'tracker'
                  ? 'bg-brand-primary text-black font-bold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Utensils className="h-3.5 w-3.5" />
              Tracker
            </button>
            
            <button
              onClick={() => setCurrentTab('monthly')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                currentTab === 'monthly'
                  ? 'bg-brand-primary text-black font-bold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Calendar
            </button>

            <button
              onClick={() => setCurrentTab('profile')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                currentTab === 'profile'
                  ? 'bg-brand-primary text-black font-bold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              Profile
            </button>
          </nav>

          {/* Desktop User Badge / Login button */}
          <div className="hidden lg:block">
            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-xl border border-dark-border text-xs">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-white max-w-[100px] truncate">{currentUser.name}</span>
                <button 
                  onClick={onLogout} 
                  title="Log Out" 
                  className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition ml-1 flex items-center gap-1 text-[10px] font-semibold"
                >
                  <LogOut className="h-3.5 w-3.5" /> Logout
                </button>
              </div>
            ) : (
              <button 
                onClick={onOpenAuth} 
                className="flex items-center gap-1.5 bg-brand-primary hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl shadow-lg shadow-brand-primary/20 transition text-xs cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" /> Login / Signup
              </button>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
