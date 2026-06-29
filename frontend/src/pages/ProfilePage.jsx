import React, { useState, useEffect } from 'react';
import { User, Settings, Award, Save, RefreshCw, BarChart2, Star, Target, Flame, Edit, Check } from 'lucide-react';
import { API_BASE } from '../config';

export default function ProfilePage({ onProfileSave, currentUser }) {
  const [profile, setProfile] = useState({
    name: 'Aravind',
    age: 28,
    height_cm: 175.0,
    weight_kg: 72.0,
    sex: 'Male',
    target_calories: 1650,
    star_target: 100
  });

  const [historyData, setHistoryData] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [chartMode, setChartMode] = useState('calories'); // 'calories' or 'grams'

  const getHeaders = () => {
    const headers = {};
    if (currentUser && currentUser.id) headers['X-User-ID'] = String(currentUser.id);
    return headers;
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/profile`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const fetchHistoryAndCalendar = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      // Fetch 7-day history
      const resHistory = await fetch(`${API_BASE}/api/history`, { headers });
      if (resHistory.ok) {
        const data = await resHistory.json();
        setHistoryData(data);
      }
      
      // Fetch 30-day calendar to compute cumulative stars
      const resCalendar = await fetch(`${API_BASE}/api/calendar`, { headers });
      if (resCalendar.ok) {
        const data = await resCalendar.json();
        setCalendarData(data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchHistoryAndCalendar();
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile({
      ...profile,
      [name]: name === 'name' || name === 'sex' ? value : parseInt(value, 10) || 0
    });
  };

  const handleStarTargetSelect = async (target) => {
    const updatedProfile = { ...profile, star_target: target };
    setProfile(updatedProfile);
    
    // Save to backend immediately
    try {
      const headers = { 'Content-Type': 'application/json', ...getHeaders() };
      await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updatedProfile)
      });
      onProfileSave();
    } catch (err) {
      console.error('Failed to save star target:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const headers = { 'Content-Type': 'application/json', ...getHeaders() };
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(profile)
      });

      if (!res.ok) {
        throw new Error('Failed to update profile.');
      }

      setSuccessMsg('Profile specifications updated.');
      setIsEditing(false);
      fetchHistoryAndCalendar();
      onProfileSave(); // refresh header
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Error occurred.');
    } finally {
      setSaving(false);
    }
  };

  // Math aggregates
  const totalStarsEarned = calendarData.reduce((acc, curr) => acc + curr.stars, 0);
  const starProgressPct = Math.min(100, Math.round((totalStarsEarned / profile.star_target) * 100));

  const totalHealthyG = historyData.reduce((acc, curr) => acc + curr.healthy_g, 0);
  const totalUnhealthyG = historyData.reduce((acc, curr) => acc + curr.unhealthy_g, 0);
  const totalCarbsG = historyData.reduce((acc, curr) => acc + curr.carb_g, 0);

  // SVG Chart Dimensions (Expanded to full screen)
  const chartHeight = 220;
  const chartWidth = 980;
  const paddingX = 50;
  const paddingY = 25;
  const graphHeight = chartHeight - 2 * paddingY;
  const graphWidth = chartWidth - 2 * paddingX;

  // Determine Y-axis max depending on mode
  let maxChartVal = 100;
  if (chartMode === 'calories') {
    const maxCalLog = Math.max(...historyData.map(d => d.calories), 100);
    maxChartVal = Math.max(maxCalLog, profile.target_calories, 1000);
  } else {
    maxChartVal = Math.max(...historyData.map(d => d.healthy_g + d.unhealthy_g), 50);
  }

  // Get appreciation rank badge
  const getAppreciationRank = () => {
    if (totalStarsEarned >= profile.star_target) return { title: 'Elite Nutrition Champ', color: 'text-amber-400 border-amber-400 bg-amber-500/10' };
    if (totalStarsEarned >= profile.star_target * 0.75) return { title: 'Gold Diet Master', color: 'text-yellow-400 border-yellow-400 bg-yellow-500/10' };
    if (totalStarsEarned >= profile.star_target * 0.5) return { title: 'Silver Wellness Expert', color: 'text-slate-300 border-slate-400 bg-slate-400/10' };
    if (totalStarsEarned >= profile.star_target * 0.25) return { title: 'Bronze Healthy Starter', color: 'text-orange-400 border-orange-400 bg-orange-500/10' };
    return { title: 'Intake Novice', color: 'text-slate-400 border-slate-500 bg-slate-500/10' };
  };

  const rank = getAppreciationRank();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 space-y-6">
      
      {/* Header and profile specification boxes in the top right */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 glass-panel rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 h-40 w-40 rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />
        
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-400 border border-teal-500/20 mb-3">
            <Award className="h-3 w-3" /> Dashboard
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white m-0">User Profile &amp; Trends</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-lg">
            Monitor nutritional scores, track daily stars target progress, and view rolling calorie limits.
          </p>
        </div>

        {/* Profile specs displayed in small compact boxes top right */}
        <div className="flex flex-wrap gap-3 lg:self-end">
          <div className="glass-card p-3 rounded-2xl min-w-[100px] text-center">
            <span className="block text-[9px] uppercase font-bold text-slate-400">Subject</span>
            <span className="text-sm font-bold text-white mt-0.5 block truncate">{profile.name} ({profile.sex})</span>
          </div>

          <div className="glass-card p-3 rounded-2xl min-w-[70px] text-center">
            <span className="block text-[9px] uppercase font-bold text-slate-400">Age</span>
            <span className="text-sm font-bold text-white mt-0.5 block">{profile.age} yrs</span>
          </div>

          <div className="glass-card p-3 rounded-2xl min-w-[90px] text-center">
            <span className="block text-[9px] uppercase font-bold text-slate-400">Weight / Ht</span>
            <span className="text-sm font-bold text-white mt-0.5 block">{profile.weight_kg}kg / {profile.height_cm}cm</span>
          </div>

          <div className="glass-card p-3 rounded-2xl min-w-[100px] text-center relative group">
            <span className="block text-[9px] uppercase font-bold text-slate-400">Calorie Target</span>
            <span className="text-sm font-bold text-teal-400 mt-0.5 block">{profile.target_calories} kcal</span>
          </div>

          <div className="glass-card p-3 rounded-2xl min-w-[100px] text-center">
            <span className="block text-[9px] uppercase font-bold text-slate-400">Star Goal</span>
            <span className="text-sm font-bold text-amber-400 mt-0.5 block">{profile.star_target} Stars</span>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 text-white rounded-2xl p-3 border border-white/10 transition cursor-pointer"
            title="Edit specs"
          >
            <Edit className="h-4.5 w-4.5 text-teal-400" />
          </button>
        </div>
      </div>

      {/* Editing Modal/Form drawer */}
      {isEditing && (
        <div className="bg-dark-card border border-brand-primary/30 rounded-3xl p-6 shadow-xl animate-fadeIn">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="h-4.5 w-4.5 text-brand-primary" /> Edit Profile specifications
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={profile.name}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Age</label>
              <input
                type="number"
                name="age"
                value={profile.age}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Sex</label>
              <select
                name="sex"
                value={profile.sex}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Height (cm)</label>
              <input
                type="number"
                name="height_cm"
                value={profile.height_cm}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                required
                step="any"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Weight (kg)</label>
              <input
                type="number"
                name="weight_kg"
                value={profile.weight_kg}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                required
                step="any"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Daily Calories</label>
              <input
                type="number"
                name="target_calories"
                value={profile.target_calories}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                required
              />
            </div>
            
            <div className="col-span-2 sm:col-span-3 md:col-span-6 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-4 py-2 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-primary hover:bg-emerald-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1"
              >
                {saving ? 'Saving...' : <><Check className="h-3.5 w-3.5" /> Save specs</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Gamified Stars Milestone Tracker */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-amber-500/5 blur-3xl" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border-b border-dark-border/60 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse">
              <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white m-0">Diet Compliance Stars Milestones</h3>
              <p className="text-xs text-slate-400 mt-0.5">Collect stars daily based on healthy vs flagged ingredient ratios.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-semibold text-slate-400">Select Star Milestone Target:</span>
            <div className="flex bg-slate-900 border border-dark-border rounded-xl p-1">
              {[100, 150, 200, 250].map((t) => (
                <button
                  key={t}
                  onClick={() => handleStarTargetSelect(t)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    profile.star_target === t 
                      ? 'bg-amber-400 text-black shadow-md' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Milestone Progress Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-9 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-300">Stars Earned this Month</span>
              <span className="text-amber-400">{totalStarsEarned} / {profile.star_target} Stars ({starProgressPct}%)</span>
            </div>
            <div className="relative w-full h-4 bg-slate-900 border border-dark-border rounded-full overflow-hidden p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                style={{ width: `${starProgressPct}%` }}
              />
            </div>
          </div>

          <div className="md:col-span-3 bg-slate-900/60 border border-dark-border p-3 rounded-2xl text-center flex flex-col items-center justify-center">
            <span className="text-[9px] uppercase font-bold text-slate-500">Appreciation Tier</span>
            <span className={`inline-block mt-1 px-3 py-1 rounded-xl text-xs font-bold border ${rank.color}`}>
              {rank.title}
            </span>
          </div>
        </div>
      </div>

      {/* Historical Trend Graph expanded to full screen width */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-44 w-44 rounded-full bg-brand-secondary/5 blur-3xl" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-dark-border/60 pb-4 mb-5 gap-3">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-brand-secondary" /> 7-Day Historical Diet Performance
            </h3>
            <p className="text-xs text-slate-400">Shows daily logged calories vs. optimized targets or macro weights.</p>
          </div>
          
          <div className="flex bg-slate-900 border border-dark-border rounded-xl p-1 shrink-0">
            <button
              onClick={() => setChartMode('calories')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                chartMode === 'calories' 
                  ? 'bg-brand-secondary text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Calories Mode
            </button>
            <button
              onClick={() => setChartMode('grams')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                chartMode === 'grams' 
                  ? 'bg-brand-secondary text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Grams Mode
            </button>
          </div>
        </div>

        {/* SVG Chart taking full width */}
        {historyData.length > 0 ? (
          <div className="flex justify-center bg-slate-900/40 p-4 rounded-2xl border border-dark-border mb-6">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
              
              {/* Y-axis Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = paddingY + graphHeight * (1 - ratio);
                const labelVal = Math.round(maxChartVal * ratio);
                return (
                  <g key={i}>
                    <line 
                      x1={paddingX} 
                      y1={y} 
                      x2={chartWidth - paddingX} 
                      y2={y} 
                      className="stroke-dark-border/40" 
                      strokeWidth="1" 
                      strokeDasharray="4 4"
                    />
                    <text 
                      x={paddingX - 10} 
                      y={y + 4} 
                      className="fill-slate-500 font-mono text-[9px] text-right"
                      textAnchor="end"
                    >
                      {labelVal}{chartMode === 'calories' ? ' kcal' : 'g'}
                    </text>
                  </g>
                );
              })}

              {/* Draw Max Calorie Level Threshold Line (Only in Calories Mode) */}
              {chartMode === 'calories' && (
                <g>
                  {/* Calculate threshold y value */}
                  {(() => {
                    const thresholdY = paddingY + graphHeight * (1 - profile.target_calories / maxChartVal);
                    return (
                      <>
                        <line
                          x1={paddingX}
                          y1={thresholdY}
                          x2={chartWidth - paddingX}
                          y2={thresholdY}
                          className="stroke-orange-500/80"
                          strokeWidth="2"
                          strokeDasharray="6 4"
                        />
                        <text
                          x={chartWidth - paddingX - 10}
                          y={thresholdY - 6}
                          className="fill-orange-400 font-bold text-[10px]"
                          textAnchor="end"
                        >
                          Target Calorie Limit: {profile.target_calories} kcal
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}

              {/* Rendering data bars */}
              {historyData.map((d, index) => {
                const barWidth = 45;
                const spacing = graphWidth / historyData.length;
                const x = paddingX + index * spacing + (spacing - barWidth) / 2;

                if (chartMode === 'calories') {
                  const calHeight = d.calories > 0 ? (d.calories / maxChartVal) * graphHeight : 0;
                  const calY = chartHeight - paddingY - calHeight;
                  const isOver = d.calories > profile.target_calories;
                  
                  return (
                    <g key={index} className="group cursor-pointer">
                      <rect
                        x={x}
                        y={calY}
                        width={barWidth}
                        height={calHeight}
                        className={`transition-all duration-300 ${
                          isOver 
                            ? 'fill-rose-500/80 hover:fill-rose-400' 
                            : 'fill-brand-secondary/80 hover:fill-brand-secondary'
                        }`}
                        rx="4"
                      />
                      
                      {/* Calories value text on top of bar */}
                      {d.calories > 0 && (
                        <text
                          x={x + barWidth / 2}
                          y={calY - 6}
                          className="fill-slate-300 font-mono text-[9px]"
                          textAnchor="middle"
                        >
                          {d.calories}
                        </text>
                      )}

                      {/* Display stars count above date */}
                      {d.calories > 0 && (
                        <g transform={`translate(${x + barWidth/2 - 22}, ${chartHeight - paddingY + 22})`}>
                          {/* Mini stars indicator */}
                          <text className="fill-amber-400 text-[8px] font-bold">
                            {'★'.repeat(d.stars)}
                          </text>
                        </g>
                      )}

                      <text
                        x={x + barWidth / 2}
                        y={chartHeight - paddingY + 14}
                        className="fill-slate-400 font-bold text-[10px]"
                        textAnchor="middle"
                      >
                        {d.label}
                      </text>
                      
                      <title>{`Date: ${d.date}\nLogged: ${d.calories} kcal\nTarget: ${profile.target_calories} kcal\nStars Quality: ${d.stars} Stars`}</title>
                    </g>
                  );
                } else {
                  // Grams breakdown view
                  const totalG = d.healthy_g + d.unhealthy_g;
                  const healthyHeight = totalG > 0 ? (d.healthy_g / maxChartVal) * graphHeight : 0;
                  const unhealthyHeight = totalG > 0 ? (d.unhealthy_g / maxChartVal) * graphHeight : 0;
                  
                  const healthyY = chartHeight - paddingY - healthyHeight;
                  const unhealthyY = healthyY - unhealthyHeight;

                  return (
                    <g key={index} className="group cursor-pointer">
                      {/* Unhealthy stack (flagged foods) */}
                      {d.unhealthy_g > 0 && (
                        <rect
                          x={x}
                          y={unhealthyY}
                          width={barWidth}
                          height={unhealthyHeight}
                          className="fill-rose-500/85 hover:fill-rose-400 transition-colors"
                          rx="2"
                        />
                      )}
                      
                      {/* Healthy stack (protein + fiber) */}
                      {d.healthy_g > 0 && (
                        <rect
                          x={x}
                          y={healthyY}
                          width={barWidth}
                          height={healthyHeight}
                          className="fill-emerald-500/85 hover:fill-emerald-400 transition-colors"
                          rx="2"
                        />
                      )}

                      <text
                        x={x + barWidth / 2}
                        y={chartHeight - paddingY + 14}
                        className="fill-slate-400 font-bold text-[10px]"
                        textAnchor="middle"
                      >
                        {d.label}
                      </text>
                      
                      <title>{`Date: ${d.date}\nHealthy: ${d.healthy_g}g\nFlagged (Refined): ${d.unhealthy_g}g\nCarbohydrates: ${d.carb_g}g`}</title>
                    </g>
                  );
                }
              })}

              {/* Base X-axis Line */}
              <line 
                x1={paddingX} 
                y1={chartHeight - paddingY} 
                x2={chartWidth - paddingX} 
                y2={chartHeight - paddingY} 
                className="stroke-slate-700" 
                strokeWidth="1.5"
              />
            </svg>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-500 text-xs">
            No history found. Create food logs to display performance charts.
          </div>
        )}

        {/* Legend / Info footer for the graph */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-2 px-2">
          {chartMode === 'calories' ? (
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-brand-secondary/80" /> Logged Calories
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-rose-500/80" /> Exceeded Calories
              </span>
              <span className="flex items-center gap-1.5">
                <span className="border-b-2 border-dashed border-orange-400 w-6" /> Daily Calorie Limit
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-emerald-500/80" /> Clean Foods (Protein + Fiber)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-rose-500/80" /> Flagged Ingredients (Refined Starch/Sugar)
              </span>
            </div>
          )}

          {/* Historical aggregates */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-emerald-400">PRO+FIB (7d): {totalHealthyG.toFixed(1)}g</span>
            <span className="text-cyan-400">CARBS (7d): {totalCarbsG.toFixed(1)}g</span>
            <span className="text-rose-400">FLAGGED (7d): {totalUnhealthyG.toFixed(1)}g</span>
          </div>
        </div>

      </div>

    </div>
  );
}
