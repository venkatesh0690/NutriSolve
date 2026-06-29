import React, { useState, useEffect, useRef } from 'react';
import { Camera, Send, FileText, Check, AlertCircle, Trash2, Utensils, Calendar } from 'lucide-react';
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
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3.5 py-1 text-xs font-bold text-teal-400 border border-teal-500/20 mb-3 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
          <Utensils className="h-4 w-4 text-teal-400" /> Daily Food Tracker
        </span>
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Log Meals &amp; Nutrition</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-slate-400">
          Track your daily calorie budget and macro distribution against your target goals.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* ─── Left Column: Log Form ─── */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-panel rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />
            <h3 className="text-xl font-bold text-white mb-5 flex items-center justify-between relative z-10 w-full">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-400" /> {(!selectedDate || selectedDate.date === localDateStr) ? "Log Today's Meals" : `Edit Meals for ${new Date((selectedDate?.date || localDateStr) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
              </span>
              {selectedDate?.has_data && (
                <button
                  type="button"
                  onClick={handleClearDay}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1 transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> Clear Day
                </button>
              )}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              {mealTypesList.map((meal) => (
                <div key={meal.key}>
                  <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    <span>{meal.emoji}</span> {meal.label}
                  </label>
                  <textarea
                    name={meal.key}
                    value={mealsForm[meal.key]}
                    onChange={handleMealChange}
                    placeholder={`What did you eat for ${meal.label.toLowerCase()}?`}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition min-h-[48px] resize-y"
                  />
                </div>
              ))}

              {/* Photo upload */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">📷 Meal Photo (Optional)</label>
                {imagePreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 h-36 bg-slate-900">
                    <img src={imagePreview} alt="Meal" className="w-full h-full object-cover" />
                    <button type="button" onClick={clearImage} className="absolute top-2 right-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl p-1.5 transition shadow-md text-xs cursor-pointer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 hover:border-teal-400/50 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-900/50 hover:bg-teal-500/5 transition group min-h-[64px]"
                  >
                    <Camera className="h-5 w-5 text-slate-400 group-hover:text-teal-400 transition mb-1" />
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-teal-300">Click or drag to upload photo</span>
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs font-semibold text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" /> <span>{error}</span>
                </div>
              )}

              {selectedDate?.has_data ? (
                <div className="flex gap-2.5 w-full pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-teal-400 to-cyan-500 hover:from-teal-500 hover:to-cyan-600 text-slate-950 font-black py-3 px-4 rounded-2xl shadow-lg shadow-teal-500/20 transition duration-300 disabled:opacity-50 flex items-center justify-center gap-2 text-xs cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Save Changes
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDay}
                    disabled={loading}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-extrabold py-3 px-4 rounded-2xl transition duration-300 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                    title="Clear all logs for this day"
                  >
                    <Trash2 className="h-4 w-4" /> Clear Day
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-teal-400 to-cyan-500 hover:from-teal-500 hover:to-cyan-600 text-slate-950 font-black py-3.5 px-4 rounded-2xl shadow-lg shadow-teal-500/20 transition duration-300 disabled:opacity-50 flex items-center justify-center gap-2 text-xs cursor-pointer pt-1"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      Saving meals...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Log Meals
                    </>
                  )}
                </button>
              )}
            </form>
          </div>

          {/* ─── Success Alert ─── */}
          {showSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 shadow-sm flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
                  <Check className="h-5 w-5 stroke-[3]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">Meal Logged Successfully</span>
                  <p className="text-[11px] text-slate-400 font-medium">Processed via AI Nutrition Engine</p>
                </div>
              </div>
              <div className="text-lg font-black px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 shadow-sm">
                {lastScore}%
              </div>
            </div>
          )}
        </div>

        {/* ─── Right Column: Reference Inspired Dashboard ─── */}
        <div className="lg:col-span-7 space-y-5">
          {/* Reference App Style Date Selector Strip */}
          <div className="glass-panel rounded-3xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[11px] uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-teal-400" /> Select Date
              </span>
              <span className="text-xs font-bold text-teal-300 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full">
                {selectedDate?.date === localDateStr ? 'Today' : selectedDate?.date}
              </span>
            </div>
            
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
              {last7Days.map((day) => {
                const isSelected = selectedDate?.date === day.date;
                const isToday = day.date === localDateStr;
                const dayOfWeek = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(day)}
                    className={`flex flex-col items-center min-w-[78px] px-3.5 py-3 rounded-2xl border transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-teal-400 to-cyan-500 border-teal-400 text-slate-950 shadow-lg shadow-teal-500/20 scale-105'
                        : day.has_data
                          ? 'bg-slate-900/60 border-white/10 hover:border-teal-400/50 text-slate-200 shadow-sm'
                          : 'bg-slate-950/40 border-white/5 text-slate-500 hover:border-white/10'
                    }`}
                  >
                    <span className={`text-[9px] font-extrabold uppercase tracking-wider ${isSelected ? 'text-slate-950/70' : 'text-slate-400'}`}>{dayOfWeek}</span>
                    <span className={`text-xl font-black mt-0.5 ${isSelected ? 'text-slate-950' : isToday ? 'text-teal-400' : 'text-white'}`}>{day.day_number}</span>
                    <span className={`text-[9px] font-semibold ${isSelected ? 'text-slate-950/70' : 'text-slate-400'}`}>{day.month_name.substring(0, 3)}</span>
                    {day.has_data && (
                      <span className={`text-[9px] font-black mt-1 px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{day.score_pct}%</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Nutrition & Calorie Balance Dashboard */}
          <div className="glass-panel rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-3 relative z-10">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Nutrition Dashboard</span>
                <h3 className="text-2xl font-black text-white mt-0.5">
                  {selectedDate
                    ? new Date(selectedDate.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Select a date'}
                </h3>
              </div>
              {selectedDate?.has_data && (
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                  <Check className="h-4 w-4" /> Compliance: {selectedDate.score_pct}%
                </span>
              )}
            </div>

            {loadingData ? (
              <div className="h-52 flex items-center justify-center">
                <div className="h-10 w-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedDate?.has_data ? (
              <div className="space-y-6 relative z-10">
                
                {/* ── Reference App Style Circular Gauge & Calorie Budget Widget ── */}
                <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  
                  {/* Calorie Dial & Big Stats (Left 7 cols) */}
                  <div className="md:col-span-7 flex items-center gap-5">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                      <svg className="h-full w-full -rotate-90">
                        <circle cx="48" cy="48" r="40" className="stroke-slate-800 fill-none" strokeWidth="8" />
                        <circle
                          cx="48" cy="48" r="40"
                          className="stroke-teal-400 fill-none transition-all duration-1000"
                          strokeWidth="8"
                          strokeDasharray={2 * Math.PI * 40}
                          strokeDashoffset={2 * Math.PI * 40 * (1 - Math.min(100, selectedDate.score_pct) / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-xl font-black text-white leading-none">{selectedDate.score_pct}%</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Goal</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Consumed vs Target</span>
                      <div className="text-3xl font-black text-white mt-0.5 tracking-tight">
                        {formatMacro(selectedDate.macros.calories)} <span className="text-base font-bold text-slate-400">/ {targetCalories} kcal</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-teal-400 text-slate-950 shadow-sm">
                          {targetCalories - formatMacro(selectedDate.macros.calories) >= 0 
                            ? `${Math.round(targetCalories - formatMacro(selectedDate.macros.calories))} kcal left` 
                            : `${Math.abs(Math.round(targetCalories - formatMacro(selectedDate.macros.calories)))} kcal over`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Macro Progress Bars (Right 5 cols) */}
                  <div className="md:col-span-5 space-y-3.5 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                    
                    {/* Protein Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-extrabold mb-1">
                        <span className="text-emerald-400 flex items-center gap-1">🟢 Protein</span>
                        <span className="text-slate-300">{formatMacro(selectedDate.macros.protein_g)}g / {targetProtein}g</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (selectedDate.macros.protein_g / targetProtein) * 100)}%` }} />
                      </div>
                    </div>

                    {/* Carbs Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-extrabold mb-1">
                        <span className="text-sky-400 flex items-center gap-1">🔵 Carbs</span>
                        <span className="text-slate-300">{formatMacro(selectedDate.macros.carb_g)}g / {targetCarbs}g</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (selectedDate.macros.carb_g / targetCarbs) * 100)}%` }} />
                      </div>
                    </div>

                    {/* Fiber Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-extrabold mb-1">
                        <span className="text-purple-400 flex items-center gap-1">🟣 Fiber</span>
                        <span className="text-slate-300">{formatMacro(selectedDate.macros.fiber_g)}g / {targetFiber}g</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (selectedDate.macros.fiber_g / targetFiber) * 100)}%` }} />
                      </div>
                    </div>

                  </div>
                </div>

                {/* ── Individual Meal Cards ── */}
                <div className="space-y-4">
                  <span className="block text-xs uppercase font-extrabold text-slate-400 tracking-wider">Tracked Meals</span>
                  {['Breakfast', 'Morning Snack', 'Lunch', 'Evening Snack', 'Dinner', 'General'].map((mType) => {
                    const mealLog = selectedDate.meals?.[mType];
                    if (!mealLog) return null;
                    const emoji = mealTypesList.find(m => m.label === mType)?.emoji || '🍴';
                    return (
                      <div key={mType} className="bg-slate-900/60 border border-white/10 hover:border-teal-400/40 rounded-3xl p-5 transition duration-300 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <span className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <span className="text-xl">{emoji}</span> {mType}
                          </span>
                          <span className="text-lg font-black text-teal-400 bg-teal-500/10 px-3.5 py-1 rounded-full border border-teal-500/20">
                            {formatMacro(mealLog.calories)} kcal
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">{mealLog.text}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-2 font-mono border-t border-white/10">
                          <span>PRO: <strong className="text-emerald-400 font-extrabold">{formatMacro(mealLog.protein_g)}g</strong></span>
                          <span>CARB: <strong className="text-sky-400 font-extrabold">{formatMacro(mealLog.carb_g)}g</strong></span>
                          <span>FIB: <strong className="text-purple-400 font-extrabold">{formatMacro(mealLog.fiber_g)}g</strong></span>
                          <span>FLG: <strong className="text-rose-400 font-extrabold">{formatMacro(mealLog.flagged_g)}g</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs relative z-10 bg-slate-900/40 rounded-3xl p-8 border border-white/10">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-slate-400 mx-auto mb-4 border border-white/10 shadow-sm">
                  <Utensils className="h-8 w-8 text-teal-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">No Food Logs Recorded</h4>
                <p className="text-slate-400 max-w-sm mx-auto font-medium">
                  {selectedDate?.date === localDateStr
                    ? 'Use the form on the left to log your meals for today and track your calories.'
                    : 'No food logs were recorded for this selected date.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
