import React, { useState, useEffect, useRef } from 'react';
import { Camera, Send, FileText, Check, AlertCircle, Trash2, Utensils } from 'lucide-react';
import { API_BASE } from '../config';

export default function DailyTrackerPage({ onLogSubmit, currentUser }) {
  const [mealsForm, setMealsForm] = useState({
    breakfast: '', morning_snack: '', lunch: '', evening_snack: '', dinner: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Simple success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastScore, setLastScore] = useState(0);

  // Data state
  const [calendarDays, setCalendarDays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [targetCalories, setTargetCalories] = useState(1650);
  const [targetProtein, setTargetProtein] = useState(144);
  const [targetCarbs, setTargetCarbs] = useState(144);
  const [targetFiber, setTargetFiber] = useState(30);
  const [targetFlagged, setTargetFlagged] = useState(15);
  const [loadingData, setLoadingData] = useState(false);

  const fileInputRef = useRef(null);

  const getLocalDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const localDateStr = getLocalDateStr();

  const getDefaultDateObject = () => ({
    date: localDateStr,
    day_number: new Date().getDate(),
    month_name: new Date().toLocaleDateString('en-US', { month: 'long' }),
    has_data: false,
    score_pct: 0.0,
    macros: { calories: 0.0, protein_g: 0.0, carb_g: 0.0, fiber_g: 0.0, flagged_g: 0.0 },
    meals: {}
  });

  const fetchData = async (resetToToday = false) => {
    setLoadingData(true);
    try {
      const ts = Date.now();
      const headers = {};
      if (currentUser && currentUser.id) headers['X-User-ID'] = String(currentUser.id);
      const resAnalytic = await fetch(`${API_BASE}/api/analytics?local_date=${localDateStr}&_t=${ts}`, { headers });
      if (resAnalytic.ok) {
        const aData = await resAnalytic.json();
        setTargetCalories(aData.target_calories || 1650);
        setTargetProtein(aData.target_protein || 144);
        setTargetCarbs(aData.target_carbs || 144);
        setTargetFiber(aData.target_fiber || 30);
        setTargetFlagged(aData.target_flagged || 15);
      }

      const ts2 = Date.now();
      const resCalendar = await fetch(`${API_BASE}/api/calendar?local_date=${localDateStr}&_t=${ts2}`, { headers });
      if (resCalendar.ok) {
        const data = await resCalendar.json();
        setCalendarDays(data);

        if (resetToToday || !selectedDate) {
          // Always select today after a new meal log or on first load
          const todayMatch = data.find(d => d.date === localDateStr);
          setSelectedDate(todayMatch || data[0] || getDefaultDateObject());
        } else {
          // Refresh whichever date was already selected
          const updated = data.find(d => d.date === selectedDate.date);
          setSelectedDate(updated || getDefaultDateObject());
        }
      } else {
        if (!selectedDate) {
          setSelectedDate(getDefaultDateObject());
        }
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      if (!selectedDate) {
        setSelectedDate(getDefaultDateObject());
      }
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Pre-populate form when selected date changes
  useEffect(() => {
    if (selectedDate) {
      setMealsForm({
        breakfast: selectedDate.meals?.['Breakfast']?.text || '',
        morning_snack: selectedDate.meals?.['Morning Snack']?.text || '',
        lunch: selectedDate.meals?.['Lunch']?.text || '',
        evening_snack: selectedDate.meals?.['Evening Snack']?.text || '',
        dinner: selectedDate.meals?.['Dinner']?.text || ''
      });
    } else {
      setMealsForm({
        breakfast: '', morning_snack: '', lunch: '', evening_snack: '', dinner: ''
      });
    }
  }, [selectedDate]);

  const handleMealChange = (e) => {
    setMealsForm({ ...mealsForm, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasText = Object.values(mealsForm).some(v => v.trim());
    if (!hasText && !imageFile && !selectedDate?.has_data) {
      setError('Please fill in at least one meal field or upload a photo.');
      return;
    }

    setLoading(true);
    setError('');
    setShowSuccess(false);

    const formData = new FormData();
    formData.append('date_str', selectedDate?.date || localDateStr);
    Object.entries(mealsForm).forEach(([k, v]) => formData.append(k, v));
    if (imageFile) formData.append('image_file', imageFile);

    try {
      const reqHeaders = {};
      if (currentUser && currentUser.id) reqHeaders['X-User-ID'] = String(currentUser.id);
      const res = await fetch(`${API_BASE}/api/intake`, { method: 'POST', headers: reqHeaders, body: formData });
      if (!res.ok) {
        let errMsg = 'Meal parsing failed.';
        try {
          const errData = await res.json();
          if (errData && errData.detail) {
            errMsg = `Error: ${errData.detail}`;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }
      const data = await res.json();

      setShowSuccess(true);
      setLastScore(data.meal_score || 0);
      clearImage();

      // Force refresh and retain selected date
      await fetchData(false);
      onLogSubmit();

      setTimeout(() => setShowSuccess(false), 8000);
    } catch (err) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDay = async () => {
    if (!window.confirm('Are you sure you want to clear all logged meals for this day?')) {
      return;
    }
    
    setLoading(true);
    setError('');
    setShowSuccess(false);

    const formData = new FormData();
    formData.append('date_str', selectedDate?.date || localDateStr);
    formData.append('breakfast', '');
    formData.append('morning_snack', '');
    formData.append('lunch', '');
    formData.append('evening_snack', '');
    formData.append('dinner', '');

    try {
      const reqHeaders = {};
      if (currentUser && currentUser.id) reqHeaders['X-User-ID'] = String(currentUser.id);
      const res = await fetch(`${API_BASE}/api/intake`, { method: 'POST', headers: reqHeaders, body: formData });
      if (!res.ok) throw new Error('Failed to clear day entry.');
      const data = await res.json();

      setShowSuccess(true);
      setLastScore(0);
      clearImage();

      // Force refresh and retain selected date
      await fetchData(false);
      onLogSubmit();

      setTimeout(() => setShowSuccess(false), 8000);
    } catch (err) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const formatMacro = (val) => Math.round((Number(val) || 0) * 100) / 100;

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (score >= 50) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  const mealTypesList = [
    { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
    { key: 'morning_snack', label: 'Morning Snack', emoji: '🍎' },
    { key: 'lunch', label: 'Lunch', emoji: '🍽️' },
    { key: 'evening_snack', label: 'Evening Snack', emoji: '🫖' },
    { key: 'dinner', label: 'Dinner', emoji: '🌙' }
  ];

  // Get last 7 days from calendar data
  const last7Days = calendarDays.slice(0, 7);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 space-y-6">
      {/* Header */}
      <div className="mb-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary border border-brand-primary/20 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <Utensils className="h-3.5 w-3.5" /> Daily Tracker
        </span>
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Daily Food Tracker</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-400">
          Log your meals and track nutrition against your optimized diet plan targets.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* ─── Left Column: Log Form ─── */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-brand-secondary/5 blur-3xl" />
            <h3 className="text-xl font-bold text-white mb-5 flex items-center justify-between relative z-10 w-full">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-secondary" /> {(!selectedDate || selectedDate.date === localDateStr) ? "Log Today's Meals" : `Edit Meals for ${new Date((selectedDate?.date || localDateStr) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
              </span>
              {selectedDate?.has_data && (
                <button
                  type="button"
                  onClick={handleClearDay}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg px-2 py-1 transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> Clear Day
                </button>
              )}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
              {mealTypesList.map((meal) => (
                <div key={meal.key}>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <span>{meal.emoji}</span> {meal.label}
                  </label>
                  <textarea
                    name={meal.key}
                    value={mealsForm[meal.key]}
                    onChange={handleMealChange}
                    placeholder={`What did you eat for ${meal.label.toLowerCase()}?`}
                    className="w-full bg-slate-900 border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-secondary/60 focus:ring-1 focus:ring-brand-secondary/20 transition min-h-[44px] resize-y"
                  />
                </div>
              ))}

              {/* Photo upload */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">📷 Meal Photo (Optional)</label>
                {imagePreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-dark-border h-36 bg-slate-900">
                    <img src={imagePreview} alt="Meal" className="w-full h-full object-cover" />
                    <button type="button" onClick={clearImage} className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-xl p-1.5 transition shadow-lg text-xs">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-dark-border hover:border-brand-secondary/30 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-slate-900/30 hover:bg-slate-900/50 transition group min-h-[60px]"
                  >
                    <Camera className="h-5 w-5 text-slate-500 group-hover:text-brand-secondary transition mb-1" />
                    <span className="text-[10px] font-semibold text-slate-400">Click or drag to upload photo</span>
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" /> <span>{error}</span>
                </div>
              )}

              {selectedDate?.has_data ? (
                <div className="flex gap-2 w-full">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-brand-secondary hover:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-brand-secondary/20 hover:shadow-brand-secondary/30 transition duration-300 disabled:opacity-50 flex items-center justify-center gap-2 text-xs cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> Save Changes
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDay}
                    disabled={loading}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 font-bold py-2.5 px-4 rounded-xl transition duration-300 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                    title="Clear all logs for this day"
                  >
                    <Trash2 className="h-4 w-4" /> Clear Day
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-secondary hover:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-brand-secondary/20 hover:shadow-brand-secondary/30 transition duration-300 disabled:opacity-50 flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving meals...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" /> Log Meals
                    </>
                  )}
                </button>
              )}
            </form>
          </div>

          {/* ─── Simple Success Message ─── */}
          {showSuccess && (
            <div className="bg-dark-card border border-emerald-500/40 rounded-2xl p-4 shadow-xl shadow-emerald-500/5 flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Check className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">Meal Logged Successfully</span>
                  <p className="text-[10px] text-slate-500">Processed via AI Nutrition Engine</p>
                </div>
              </div>
              <div className={`text-lg font-black px-4 py-2 rounded-xl border ${getScoreBg(lastScore)}`}>
                {lastScore}%
              </div>
            </div>
          )}
        </div>

        {/* ─── Right Column: Date Selector + Intake Report ─── */}
        <div className="lg:col-span-7 space-y-5">
          {/* Previous Week Date Chips */}
          <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-xl">
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">📅 Select Date to View Intake</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {last7Days.map((day) => {
                const isSelected = selectedDate?.date === day.date;
                const isToday = day.date === localDateStr;
                const dayOfWeek = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(day)}
                    className={`flex flex-col items-center min-w-[72px] px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? 'bg-brand-primary/15 border-brand-primary text-white ring-1 ring-brand-primary/30 shadow-lg shadow-brand-primary/10 scale-105'
                        : day.has_data
                          ? 'bg-slate-900/60 border-dark-border hover:border-slate-600 hover:bg-slate-800/60 text-slate-300'
                          : 'bg-slate-900/30 border-dark-border/40 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{dayOfWeek}</span>
                    <span className={`text-lg font-black mt-0.5 ${isToday ? 'text-brand-primary' : ''}`}>{day.day_number}</span>
                    <span className="text-[8px] text-slate-500 font-semibold">{day.month_name.substring(0, 3)}</span>
                    {day.has_data && (
                      <span className={`text-[9px] font-bold mt-1 ${getScoreColor(day.score_pct)}`}>{day.score_pct}%</span>
                    )}
                    {isToday && <span className="text-[7px] text-brand-primary font-bold mt-0.5 uppercase">Today</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Nutrition Report */}
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-5">
            <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-brand-primary/5 blur-3xl" />

            {/* Report Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-dark-border/60 pb-3 gap-2 relative z-10">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nutrition Summary</span>
                <h3 className="text-xl font-bold text-white mt-0.5">
                  {selectedDate
                    ? new Date(selectedDate.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Select a date'}
                </h3>
              </div>
              {selectedDate?.has_data && (
                <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${getScoreBg(selectedDate.score_pct)}`}>
                  Calorie Compliance: {selectedDate.score_pct}%
                </span>
              )}
            </div>

            {loadingData ? (
              <div className="h-44 flex items-center justify-center">
                <div className="h-8 w-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedDate?.has_data ? (
              <div className="space-y-6 relative z-10">
                {/* ── Macro Summary with BIGGER fonts ── */}
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">Macro Tracker Summary</span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                    <div className="bg-slate-900/60 p-3 rounded-2xl border border-dark-border col-span-2 sm:col-span-1">
                      <span className="block text-[9px] text-slate-500 font-semibold uppercase">Calories</span>
                      <span className="text-2xl font-black text-orange-400 block mt-1">
                        {formatMacro(selectedDate.macros.calories)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">/ {targetCalories} kcal</span>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-2xl border border-dark-border">
                      <span className="block text-[9px] text-slate-500 font-semibold uppercase">Protein</span>
                      <span className="text-2xl font-black text-emerald-400 block mt-1">{formatMacro(selectedDate.macros.protein_g)}g</span>
                      <span className="text-[10px] text-slate-500 font-semibold">/ {targetProtein}g</span>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-2xl border border-dark-border">
                      <span className="block text-[9px] text-slate-500 font-semibold uppercase">Carbs</span>
                      <span className="text-2xl font-black text-cyan-400 block mt-1">{formatMacro(selectedDate.macros.carb_g)}g</span>
                      <span className="text-[10px] text-slate-500 font-semibold">/ {targetCarbs}g</span>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-2xl border border-dark-border">
                      <span className="block text-[9px] text-slate-500 font-semibold uppercase">Fiber</span>
                      <span className="text-2xl font-black text-blue-400 block mt-1">{formatMacro(selectedDate.macros.fiber_g)}g</span>
                      <span className="text-[10px] text-slate-500 font-semibold">/ {targetFiber}g</span>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-2xl border border-dark-border">
                      <span className="block text-[9px] text-slate-500 font-semibold uppercase">Flagged</span>
                      <span className="text-2xl font-black text-rose-400 block mt-1">{formatMacro(selectedDate.macros.flagged_g)}g</span>
                      <span className="text-[10px] text-slate-500 font-semibold">/ {targetFlagged}g</span>
                    </div>
                  </div>
                </div>

                {/* ── Individual Meal Breakdown ── */}
                <div className="space-y-3">
                  <span className="block text-xs uppercase font-bold text-slate-400 tracking-wider">Meal Breakdown</span>
                  {['Breakfast', 'Morning Snack', 'Lunch', 'Evening Snack', 'Dinner', 'General'].map((mType) => {
                    const mealLog = selectedDate.meals?.[mType];
                    if (!mealLog) return null;
                    return (
                      <div key={mType} className="bg-slate-900/40 border border-dark-border rounded-2xl p-4">
                        <div className="flex items-center justify-between border-b border-dark-border/40 pb-2 mb-2">
                          <span className="text-sm font-bold text-brand-secondary uppercase tracking-wider">
                            {mealTypesList.find(m => m.label === mType)?.emoji || '🍴'} {mType}
                          </span>
                          <span className="text-xl font-black text-orange-400">{formatMacro(mealLog.calories)} kcal</span>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed">{mealLog.text}</p>
                        <div className="flex gap-4 text-xs text-slate-400 mt-3 border-t border-dark-border/40 pt-2 font-mono">
                          <span>PRO: <strong className="text-emerald-400">{formatMacro(mealLog.protein_g)}g</strong></span>
                          <span>CARB: <strong className="text-cyan-400">{formatMacro(mealLog.carb_g)}g</strong></span>
                          <span>FIB: <strong className="text-blue-400">{formatMacro(mealLog.fiber_g)}g</strong></span>
                          <span>FLG: <strong className="text-rose-400">{formatMacro(mealLog.flagged_g)}g</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs relative z-10">
                {selectedDate?.date === localDateStr
                  ? '🍽️ No food logs for today yet. Use the form on the left to log meals.'
                  : '📋 No food logs recorded for this date.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
