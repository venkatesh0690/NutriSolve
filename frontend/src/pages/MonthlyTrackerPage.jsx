import React, { useState, useEffect } from 'react';
import { Calendar, Star, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE } from '../config';

export default function MonthlyTrackerPage({ currentUser }) {
  const [calendarDays, setCalendarDays] = useState([]);
  const [clickedDay, setClickedDay] = useState(null);
  const [targetCalories, setTargetCalories] = useState(1650);
  const [targetProtein, setTargetProtein] = useState(144);
  const [targetCarbs, setTargetCarbs] = useState(144);
  const [targetFiber, setTargetFiber] = useState(30);
  const [targetFlagged, setTargetFlagged] = useState(15);
  const [loading, setLoading] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const getLocalDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const localDateStr = getLocalDateStr();

  const fetchData = async () => {
    setLoading(true);
    try {
      const ts = Date.now();
      const headers = {};
      if (currentUser && currentUser.id) headers['X-User-ID'] = String(currentUser.id);
      const resAnalytic = await fetch(`${API_BASE}/api/analytics?local_date=${localDateStr}&_t=${ts}`, { headers });
      if (resAnalytic.ok) {
        const data = await resAnalytic.json();
        setTargetCalories(data.target_calories || 1650);
        setTargetProtein(data.target_protein || 144);
        setTargetCarbs(data.target_carbs || 144);
        setTargetFiber(data.target_fiber || 30);
        setTargetFlagged(data.target_flagged || 15);
      }

      const ts2 = Date.now();
      const res = await fetch(`${API_BASE}/api/calendar?local_date=${localDateStr}&_t=${ts2}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCalendarDays(data);
      }
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Build a map of date -> day data for quick lookup
  const dayMap = {};
  calendarDays.forEach(d => { dayMap[d.date] = d; });

  // Calendar grid helpers
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfWeek = (year, month) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(viewMonth.year, viewMonth.month);
  const firstDayOfWeek = getFirstDayOfWeek(viewMonth.year, viewMonth.month);

  // Build calendar grid cells
  const calendarCells = [];
  // Empty cells for days before the 1st
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push({ empty: true, key: `empty-${i}` });
  }
  // Actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = dayMap[dateStr] || null;
    calendarCells.push({ empty: false, day, dateStr, dayData, key: dateStr });
  }

  const navigateMonth = (delta) => {
    setViewMonth(prev => {
      let newMonth = prev.month + delta;
      let newYear = prev.year;
      if (newMonth < 0) { newMonth = 11; newYear--; }
      if (newMonth > 11) { newMonth = 0; newYear++; }
      return { year: newYear, month: newMonth };
    });
    setClickedDay(null);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (score >= 50) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  };

  const getCellBg = (dayData) => {
    if (!dayData || !dayData.has_data) return 'bg-slate-900/20 border-dark-border/30';
    const score = dayData.score_pct;
    if (score >= 80) return 'bg-emerald-500/8 border-emerald-500/25';
    if (score >= 50) return 'bg-amber-500/8 border-amber-500/25';
    return 'bg-rose-500/8 border-rose-500/25';
  };

  const renderStars = (count, size = '9px') => (
    <div className="flex gap-px justify-center">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i < count ? 'fill-amber-400 text-amber-400' : 'fill-slate-700 text-slate-700'}
        />
      ))}
    </div>
  );

  // Stats
  const daysWithData = calendarDays.filter(d => d.has_data).length;
  const totalStars = calendarDays.reduce((sum, d) => sum + (d.stars || 0), 0);
  const avgScore = daysWithData > 0
    ? Math.round(calendarDays.filter(d => d.has_data).reduce((s, d) => s + d.score_pct, 0) / daysWithData)
    : 0;
  const milestones = [25, 50, 100, 150, 200, 250];
  const nextMilestone = milestones.find(m => m > totalStars) || milestones[milestones.length - 1];
  const milestoneProgress = Math.min(100, (totalStars / nextMilestone) * 100);

  const mealTypesList = [
    { label: 'Breakfast', emoji: '🌅' },
    { label: 'Morning Snack', emoji: '🍎' },
    { label: 'Lunch', emoji: '🍽️' },
    { label: 'Evening Snack', emoji: '🫖' },
    { label: 'Dinner', emoji: '🌙' },
    { label: 'General', emoji: '🍴' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 space-y-6">
      {/* Minimal Hero Banner Box */}
      <div className="mb-8 text-center relative overflow-hidden glass-panel rounded-3xl p-6 sm:p-8 border border-teal-500/20 shadow-xl">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-12 -mb-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        
        <span className="inline-flex items-center gap-2 rounded-full bg-teal-500/10 px-4 py-1.5 text-xs font-black text-teal-400 border border-teal-500/20 mb-3 shadow-sm">
          <Calendar className="h-4 w-4 text-teal-400" /> Monthly Overview
        </span>
        <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight m-0">
          <span className="bg-gradient-to-r from-teal-300 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Monthly Calendar
          </span>
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-slate-400">
          Track your monthly intake compliance. Click any date to view detailed meal logs.
        </p>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4 text-center">
          <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Stars</span>
          <span className="text-2xl font-black text-amber-400 flex items-center justify-center gap-1 mt-1">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" /> {totalStars}
          </span>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Days Tracked</span>
          <span className="text-2xl font-black text-teal-400 mt-1">{daysWithData}</span>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Avg Score</span>
          <span className={`text-2xl font-black mt-1 ${getScoreColor(avgScore)}`}>{avgScore}%</span>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Next Milestone</span>
          <span className="text-2xl font-black text-purple-400 mt-1">{nextMilestone} ⭐</span>
          <div className="h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full transition-all duration-700" style={{ width: `${milestoneProgress}%` }} />
          </div>
          <span className="text-[8px] text-slate-500 mt-1">{totalStars}/{nextMilestone}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Calendar Grid */}
        <div className={`${clickedDay ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all duration-300`}>
          <div className="glass-panel rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-5 relative z-10">
              <button
                onClick={() => navigateMonth(-1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white transition text-xs font-medium"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-teal-400" />
                {monthNames[viewMonth.month]} {viewMonth.year}
              </h3>
              <button
                onClick={() => navigateMonth(1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-dark-border text-slate-300 hover:bg-slate-800 hover:text-white transition text-xs font-medium"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <div className="h-60 flex items-center justify-center">
                <div className="h-8 w-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="relative z-10">
                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {dayNames.map(dn => (
                    <div key={dn} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider py-1">
                      {dn}
                    </div>
                  ))}
                </div>

                {/* Calendar cells */}
                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map((cell) => {
                    if (cell.empty) {
                      return <div key={cell.key} className="h-[80px]" />;
                    }

                    const { day, dateStr, dayData } = cell;
                    const isToday = dateStr === localDateStr;
                    const isSelected = clickedDay?.date === dateStr || clickedDay?.dateStr === dateStr;
                    const hasData = dayData && dayData.has_data;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => {
                          if (hasData) {
                            setClickedDay(isSelected ? null : dayData);
                          }
                        }}
                        disabled={!hasData}
                        className={`flex flex-col items-center justify-between p-1.5 rounded-xl border text-center h-[80px] transition-all duration-200 ${getCellBg(dayData)} ${
                          isSelected
                            ? 'ring-2 ring-brand-primary scale-[1.06] shadow-lg shadow-brand-primary/10 border-brand-primary bg-slate-900/80'
                            : hasData ? 'hover:scale-[1.03] cursor-pointer' : 'opacity-50 cursor-default'
                        } ${isToday ? 'ring-1 ring-brand-secondary/40' : ''}`}
                      >
                        {/* Day number */}
                        <span className={`text-xs font-bold w-full text-left px-0.5 ${isToday ? 'text-brand-primary' : hasData ? 'text-slate-200' : 'text-slate-600'}`}>
                          {day}
                        </span>

                        {hasData ? (
                          <div className="flex flex-col items-center justify-center flex-1 w-full">
                            <span className={`text-sm font-black leading-none ${getScoreColor(dayData.score_pct)}`}>
                              {dayData.score_pct}%
                            </span>
                            <div className="mt-1">
                              {renderStars(dayData.stars, '8px')}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 font-mono">{dayData.macros.calories} kcal</span>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center">
                            <span className="text-[9px] text-slate-700">—</span>
                          </div>
                        )}

                        {isToday && (
                          <span className="text-[6px] text-brand-primary font-bold uppercase tracking-wider">TODAY</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {clickedDay && (
          <div className="lg:col-span-5 animate-fadeIn">
            <div className="bg-dark-card border border-brand-primary/30 rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-5 sticky top-28">
              <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-brand-primary/5 blur-3xl" />

              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-dark-border/60 pb-3 relative z-10">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detailed Report</span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    {new Date(clickedDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {clickedDay.has_data && (
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-lg border ${getScoreBg(clickedDay.score_pct)}`}>
                      {clickedDay.score_pct}%
                    </span>
                  )}
                  <button onClick={() => setClickedDay(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg p-1.5 border border-dark-border transition">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {clickedDay.has_data ? (
                <div className="space-y-5 relative z-10">
                  {/* Macro totals */}
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-dark-border">
                      <span className="block text-[7px] text-slate-500 font-semibold uppercase">Cal</span>
                      <span className="text-base font-black text-orange-400">{clickedDay.macros.calories}</span>
                      <span className="block text-[7px] text-slate-600">/ {targetCalories}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-dark-border">
                      <span className="block text-[7px] text-slate-500 font-semibold uppercase">Pro</span>
                      <span className="text-base font-black text-emerald-400">{clickedDay.macros.protein_g}g</span>
                      <span className="block text-[7px] text-slate-600">/ {targetProtein}g</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-dark-border">
                      <span className="block text-[7px] text-slate-500 font-semibold uppercase">Carb</span>
                      <span className="text-base font-black text-cyan-400">{clickedDay.macros.carb_g}g</span>
                      <span className="block text-[7px] text-slate-600">/ {targetCarbs}g</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-dark-border">
                      <span className="block text-[7px] text-slate-500 font-semibold uppercase">Fib</span>
                      <span className="text-base font-black text-blue-400">{clickedDay.macros.fiber_g}g</span>
                      <span className="block text-[7px] text-slate-600">/ {targetFiber}g</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-dark-border">
                      <span className="block text-[7px] text-slate-500 font-semibold uppercase">Flg</span>
                      <span className="text-base font-black text-rose-400">{clickedDay.macros.flagged_g}g</span>
                      <span className="block text-[7px] text-slate-600">/ {targetFlagged}g</span>
                    </div>
                  </div>

                  {/* Star rating */}
                  <div className="flex items-center justify-center gap-2 py-2 bg-slate-900/40 rounded-xl border border-dark-border">
                    {renderStars(clickedDay.stars, '16px')}
                    <span className="text-xs font-bold text-slate-400 ml-1">{clickedDay.stars}/5 Stars</span>
                  </div>

                  {/* Meal entries */}
                  <div className="space-y-2.5 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
                    <span className="block text-xs uppercase font-bold text-slate-400 tracking-wider">Meals</span>
                    {mealTypesList.map(({ label: mType, emoji }) => {
                      const mealLog = clickedDay.meals?.[mType];
                      if (!mealLog) return null;
                      return (
                        <div key={mType} className="bg-slate-900/40 border border-dark-border rounded-xl p-3">
                          <div className="flex items-center justify-between pb-1.5 border-b border-dark-border/40 mb-1.5">
                            <span className="text-xs font-bold text-brand-secondary uppercase">{emoji} {mType}</span>
                            <span className="text-lg font-black text-orange-400">{mealLog.calories} <span className="text-xs text-slate-500 font-semibold">kcal</span></span>
                          </div>
                          <p className="text-sm text-slate-200 leading-snug">{mealLog.text}</p>
                          <div className="flex gap-3 text-[11px] text-slate-400 mt-2 font-mono">
                            <span>PRO: <strong className="text-emerald-400">{mealLog.protein_g}g</strong></span>
                            <span>CARB: <strong className="text-cyan-400">{mealLog.carb_g}g</strong></span>
                            <span>FIB: <strong className="text-blue-400">{mealLog.fiber_g}g</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-slate-500 relative z-10">
                  📋 No log entries for this date.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
