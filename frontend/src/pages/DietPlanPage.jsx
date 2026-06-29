import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, Scale, Heart, AlertTriangle, CheckCircle, Flame, Activity, Info, Plus, Minus } from 'lucide-react';
import { API_BASE } from '../config';

export default function DietPlanPage({ onPlanSubmit, currentUser }) {
  const [formData, setFormData] = useState({
    weight_kg: '',
    height_cm: '',
    body_fat_pct: '',
    hba1c_pct: '',
    fasting_glucose_mg_dl: '',
    cholesterol_ldl_mg_dl: '',
    cholesterol_hdl_mg_dl: '',
    vitamin_d_ng_ml: '',
    steps_per_day: '5000',
    activity_level: 'sedentary',
    active_issues: '',
    family_history: ''
  });

  const [loading, setLoading] = useState(false);
  const [dietPlan, setDietPlan] = useState(null);
  const [error, setError] = useState('');
  const [activeTooltip, setActiveTooltip] = useState(null); // 'bmr', 'tdee', etc for mobile tap
  const [showRecommended, setShowRecommended] = useState(true);
  const [showAvoid, setShowAvoid] = useState(true);

  const renderBullets = (text, dotColor = 'bg-brand-primary') => {
    if (!text) return null;
    // Split by bullet point symbols or sentences
    const items = text.split(/(?:•|;|\n|:\s*(?=[A-Z0-9]))/).map(s => s.strip ? s.strip() : s.trim()).filter(Boolean);
    if (items.length <= 1) {
      return <p className="text-xs text-slate-300 leading-relaxed font-normal">{text}</p>;
    }
    return (
      <ul className="space-y-1.5 mt-2">
        {items.map((item, idx) => (
          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
            <span className={`h-1.5 w-1.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  };

  // Fetch the latest plan on mount to show saved baseline data
  useEffect(() => {
    const fetchLatestPlan = async () => {
      try {
        const headers = {};
        if (currentUser && currentUser.id) headers['X-User-ID'] = String(currentUser.id);
        const res = await fetch(`${API_BASE}/api/metrics/latest`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.has_plan) {
            setDietPlan(data);
            const m = data.metrics;
            if (m) {
              setFormData({
                weight_kg: m.weight_kg || '',
                height_cm: m.height_cm || '',
                body_fat_pct: m.body_fat_pct || '',
                hba1c_pct: m.hba1c_pct || '',
                fasting_glucose_mg_dl: m.fasting_glucose_mg_dl || '',
                cholesterol_ldl_mg_dl: m.cholesterol_ldl_mg_dl || '',
                cholesterol_hdl_mg_dl: m.cholesterol_hdl_mg_dl || '',
                vitamin_d_ng_ml: m.vitamin_d_ng_ml || '',
                steps_per_day: m.steps_per_day || '5000',
                activity_level: m.activity_level || 'sedentary',
                active_issues: m.active_issues || '',
                family_history: m.family_history || ''
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to load latest plan:', err);
      }
    };
    fetchLatestPlan();
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const requiredKeys = [
      'weight_kg',
      'height_cm',
      'body_fat_pct',
      'hba1c_pct',
      'fasting_glucose_mg_dl',
      'cholesterol_ldl_mg_dl',
      'cholesterol_hdl_mg_dl',
      'vitamin_d_ng_ml'
    ];
    for (const key of requiredKeys) {
      if (formData[key] === '') {
        setError('Please fill in all physiological & blood markers before calculating.');
        setLoading(false);
        return;
      }
    }

    try {
      const reqHeaders = { 'Content-Type': 'application/json' };
      if (currentUser && currentUser.id) reqHeaders['X-User-ID'] = String(currentUser.id);
      const res = await fetch(`${API_BASE}/api/metrics`, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          weight_kg: parseFloat(formData.weight_kg),
          height_cm: parseFloat(formData.height_cm),
          body_fat_pct: parseFloat(formData.body_fat_pct),
          hba1c_pct: parseFloat(formData.hba1c_pct),
          fasting_glucose_mg_dl: parseFloat(formData.fasting_glucose_mg_dl),
          cholesterol_ldl_mg_dl: parseFloat(formData.cholesterol_ldl_mg_dl),
          cholesterol_hdl_mg_dl: parseFloat(formData.cholesterol_hdl_mg_dl),
          vitamin_d_ng_ml: parseFloat(formData.vitamin_d_ng_ml),
          steps_per_day: parseInt(formData.steps_per_day, 10) || 5000,
          activity_level: formData.activity_level || 'sedentary',
          active_issues: formData.active_issues,
          family_history: formData.family_history
        })
      });

      if (!res.ok) {
        let errMsg = 'Failed to compute scoring plan. Check server logs.';
        try {
          const errData = await res.json();
          if (errData && errData.detail) {
            errMsg = `Error: ${errData.detail}`;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      setDietPlan(data);
      onPlanSubmit();
    } catch (err) {
      setError(err.message || 'Server error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    if (!status) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    const s = String(status).toLowerCase();
    if (s.includes('healthy') || s.includes('optimal') || s.includes('sufficient') || s.includes('normal')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (s.includes('overweight') || s.includes('borderline') || s.includes('insufficient') || s.includes('near') || s.includes('pre') || s.includes('high')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  };

  const toggleTooltip = (name) => {
    setActiveTooltip(prev => prev === name ? null : name);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      
      {/* Introduction Banner */}
      <div className="mb-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary border border-brand-primary/20 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <Sparkles className="h-3 w-3" /> Algorithmic Optimization
        </span>
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Optimized Diet Plan</h2>
        <p className="mx-auto mt-2 max-w-2xl text-base text-slate-400">
          Enter your multi-variable physiological, blood, and metabolic markers to generate a mathematically tailored nutritional blueprint.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Metric collection form */}
        <div className="lg:col-span-5 bg-dark-card border border-dark-border rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-brand-primary/5 blur-3xl" />
          
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Scale className="h-5 w-5 text-brand-primary" /> Physiological &amp; Metabolic Markers
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Weight (kg)</label>
                <input
                  type="number"
                  name="weight_kg"
                  value={formData.weight_kg}
                  onChange={handleChange}
                  placeholder="e.g. 72"
                  className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
                  step="any"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Height (cm)</label>
                <input
                  type="number"
                  name="height_cm"
                  value={formData.height_cm}
                  onChange={handleChange}
                  placeholder="e.g. 168"
                  className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
                  step="any"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Body Fat Percentage (%)</label>
                <input
                  type="number"
                  name="body_fat_pct"
                  value={formData.body_fat_pct}
                  onChange={handleChange}
                  placeholder="e.g. 24"
                  className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
                  step="any"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Vitamin D (ng/mL)</label>
                <input
                  type="number"
                  name="vitamin_d_ng_ml"
                  value={formData.vitamin_d_ng_ml}
                  onChange={handleChange}
                  placeholder="e.g. 30"
                  className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
                  step="any"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">HbA1c (%)</label>
                <input
                  type="number"
                  name="hba1c_pct"
                  value={formData.hba1c_pct}
                  onChange={handleChange}
                  placeholder="e.g. 5.6"
                  className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
                  step="any"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Fasting Glucose (mg/dL)</label>
                <input
                  type="number"
                  name="fasting_glucose_mg_dl"
                  value={formData.fasting_glucose_mg_dl}
                  onChange={handleChange}
                  placeholder="e.g. 95"
                  className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
                  step="any"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">LDL Cholesterol (mg/dL)</label>
                <input
                  type="number"
                  name="cholesterol_ldl_mg_dl"
                  value={formData.cholesterol_ldl_mg_dl}
                  onChange={handleChange}
                  placeholder="e.g. 110"
                  className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
                  step="any"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">HDL Cholesterol (mg/dL)</label>
                <input
                  type="number"
                  name="cholesterol_hdl_mg_dl"
                  value={formData.cholesterol_hdl_mg_dl}
                  onChange={handleChange}
                  placeholder="e.g. 45"
                  className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
                  step="any"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Daily Steps Count</label>
                <input
                  type="number"
                  name="steps_per_day"
                  value={formData.steps_per_day}
                  onChange={handleChange}
                  placeholder="e.g. 6000"
                  className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Activity Level</label>
                <select
                  name="activity_level"
                  value={formData.activity_level}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-dark-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary transition"
                >
                  <option value="sedentary">Sedentary (Little/no exercise, desk job) - 1.200</option>
                  <option value="lightly_active">Lightly Active (Light exercise 1–3 days/wk) - 1.375</option>
                  <option value="moderately_active">Moderately Active (Moderate activity 3–5 days/wk) - 1.550</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Active Health Issues</label>
              <input
                type="text"
                name="active_issues"
                value={formData.active_issues}
                onChange={handleChange}
                placeholder="e.g. hypertension, fatty liver, none"
                className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Family Medical History</label>
              <input
                type="text"
                name="family_history"
                value={formData.family_history}
                onChange={handleChange}
                placeholder="e.g. cardiovascular disease, diabetes, obesity"
                className="w-full bg-slate-900 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary transition"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-emerald-400 text-black font-bold py-3 px-4 rounded-xl shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Calculating Blueprint...
                </>
              ) : (
                'Generate Nutrition Blueprint'
              )}
            </button>
          </form>
        </div>

        {/* Scoring Engine Visualization & Diet Output */}
        <div className="lg:col-span-7 space-y-6">
          {dietPlan ? (
            <>
              {/* Scoring Engine Diagnostics */}
              <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-xl">
                <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-brand-primary" /> Physiological &amp; Blood Diagnostics
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Daily Target Calorie Count Card */}
                  <div 
                    onClick={() => toggleTooltip('daily_cal')}
                    className="group relative bg-slate-900/60 p-4 rounded-2xl border border-dark-border hover:border-amber-500/50 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <Flame className="h-3 w-3 text-amber-400" /> Daily Target Calories
                      </span>
                      <Info className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 transition" />
                    </div>

                    <div className="text-xl font-black text-white mt-1.5">
                      {dietPlan.macros?.calories || 2000} <span className="text-xs font-semibold text-slate-400">kcal/day</span>
                    </div>

                    <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
                      Calculated Target
                    </span>

                    {/* Tooltip on Hover / Tap */}
                    <div className={`absolute left-0 right-0 top-full mt-2 z-30 p-3 bg-slate-950 border border-amber-500/30 rounded-xl shadow-2xl text-[11px] text-slate-300 leading-relaxed pointer-events-none transition-all duration-200 ${activeTooltip === 'daily_cal' ? 'block' : 'hidden group-hover:block'}`}>
                      <p className="font-semibold text-amber-400 mb-1 flex items-center gap-1">
                        <Flame className="h-3 w-3" /> Daily Calorie Goal
                      </p>
                      Mathematically tailored daily energy target designed to achieve your metabolic health and body composition goals.
                    </div>
                  </div>

                  {/* Daily Step Target Card */}
                  <div 
                    onClick={() => toggleTooltip('steps_target')}
                    className="group relative bg-slate-900/60 p-4 rounded-2xl border border-dark-border hover:border-brand-primary/50 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <Activity className="h-3 w-3 text-brand-primary" /> Daily Step Goal
                      </span>
                      <Info className="h-3.5 w-3.5 text-slate-500 group-hover:text-brand-primary transition" />
                    </div>

                    <div className="text-xl font-black text-brand-primary mt-1.5">
                      {dietPlan.calculated_metrics?.step_target_str || '100%'} <span className="text-xs font-semibold text-slate-400">completed</span>
                    </div>

                    <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded border bg-brand-primary/10 text-brand-primary border-brand-primary/20">
                      {dietPlan.calculated_metrics?.step_target_status || 'BMI Target: 10,000 steps'}
                    </span>

                    {/* Tooltip on Hover / Tap */}
                    <div className={`absolute left-0 right-0 top-full mt-2 z-30 p-3 bg-slate-950 border border-brand-primary/30 rounded-xl shadow-2xl text-[11px] text-slate-300 leading-relaxed pointer-events-none transition-all duration-200 ${activeTooltip === 'steps_target' ? 'block' : 'hidden group-hover:block'}`}>
                      <p className="font-semibold text-brand-primary mb-1 flex items-center gap-1">
                        <Activity className="h-3 w-3" /> BMI Step Target %
                      </p>
                      Your daily step completion percentage calculated against a recommended physical activity goal customized to your BMI.
                    </div>
                  </div>

                  {/* Metabolic Status Card */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Metabolic Status</span>
                    <div className="text-md font-bold text-white mt-2 truncate">
                      {dietPlan.calculated_metrics?.metabolic_status || 'Normal'}
                    </div>
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(dietPlan.calculated_metrics?.metabolic_status || 'Normal')}`}>
                      HbA1c &amp; Glucose
                    </span>
                  </div>

                  {/* LDL Status */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">LDL Cholesterol</span>
                    <div className="text-md font-bold text-white mt-2 truncate">
                      {dietPlan.calculated_metrics?.ldl_status || 'Optimal'}
                    </div>
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(dietPlan.calculated_metrics?.ldl_status || 'Optimal')}`}>
                      LDL Status
                    </span>
                  </div>

                  {/* HDL Status */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">HDL Cholesterol</span>
                    <div className="text-md font-bold text-white mt-2 truncate">
                      {dietPlan.calculated_metrics?.hdl_status || 'Normal'}
                    </div>
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(dietPlan.calculated_metrics?.hdl_status || 'Normal')}`}>
                      HDL Status
                    </span>
                  </div>

                  {/* Vitamin D status */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vitamin D level</span>
                    <div className="text-md font-bold text-white mt-2 truncate">
                      {dietPlan.calculated_metrics?.vit_d_status || 'Sufficient'}
                    </div>
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(dietPlan.calculated_metrics?.vit_d_status || 'Sufficient')}`}>
                      Vitamin D
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Meal Plan */}
              <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-xl space-y-6">
                
                {/* Calories & Macro Splits */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-dark-border/60 pb-5 gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Heart className="h-5 w-5 text-rose-500" /> Customized Meal Plan
                    </h3>
                    <p className="text-xs text-slate-400">Baseline calculated targets for dietary adjustments</p>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-slate-900 px-4 py-2.5 rounded-2xl border border-dark-border">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Daily Target</span>
                      <span className="text-lg font-black text-brand-primary">{dietPlan.macros?.calories} kcal</span>
                    </div>
                    <div className="h-8 w-px bg-dark-border" />
                    <div className="flex gap-3 text-xs">
                      <div>
                        <span className="block text-[9px] text-slate-500 uppercase font-semibold">PRO</span>
                        <span className="font-bold text-emerald-400">{dietPlan.macros?.protein_g}g</span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-slate-500 uppercase font-semibold">CARB</span>
                        <span className="font-bold text-cyan-400">{dietPlan.macros?.carb_g}g</span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-slate-500 uppercase font-semibold">FAT</span>
                        <span className="font-bold text-amber-400">{dietPlan.macros?.fat_g}g</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meal Sections */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border border-l-4 border-l-brand-primary shadow-md">
                    <span className="text-[10px] font-extrabold uppercase text-brand-primary tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-brand-primary animate-pulse" /> Breakfast Option
                    </span>
                    {renderBullets(dietPlan.meal_plan?.breakfast, 'bg-brand-primary')}
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border border-l-4 border-l-emerald-400 shadow-md">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Lunch Option
                    </span>
                    {renderBullets(dietPlan.meal_plan?.lunch, 'bg-emerald-400')}
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border border-l-4 border-l-amber-400 shadow-md">
                    <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" /> Evening Snack
                    </span>
                    {renderBullets(dietPlan.meal_plan?.snacks, 'bg-amber-400')}
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border border-l-4 border-l-cyan-400 shadow-md">
                    <span className="text-[10px] font-extrabold uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" /> Dinner Option
                    </span>
                    {renderBullets(dietPlan.meal_plan?.dinner, 'bg-cyan-400')}
                  </div>
                </div>

                {/* Recommended vs Avoid Foods (Collapsible + / -) */}
                <div className="grid gap-4 md:grid-cols-2 border-t border-dark-border/60 pt-5">
                  {/* Recommended Clean Foods */}
                  <div className="space-y-3 bg-slate-900/40 p-4 rounded-2xl border border-dark-border/60">
                    <div 
                      onClick={() => setShowRecommended(!showRecommended)}
                      className="flex items-center justify-between cursor-pointer select-none group"
                    >
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5" /> Recommended Clean Foods
                      </span>
                      <button 
                        type="button"
                        className="h-6 w-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500/20 transition"
                      >
                        {showRecommended ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {showRecommended && (
                      <ul className="space-y-1.5 transition-all duration-300">
                        {dietPlan.recommended_foods?.map((food, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-center gap-2 bg-slate-900/60 px-3 py-2 rounded-xl border border-dark-border/40 hover:border-emerald-500/30 transition">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span>{food}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Foods & Ingredients to Avoid */}
                  <div className="space-y-3 bg-slate-900/40 p-4 rounded-2xl border border-dark-border/60">
                    <div 
                      onClick={() => setShowAvoid(!showAvoid)}
                      className="flex items-center justify-between cursor-pointer select-none group"
                    >
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Foods &amp; Ingredients to Avoid
                      </span>
                      <button 
                        type="button"
                        className="h-6 w-6 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center group-hover:bg-rose-500/20 transition"
                      >
                        {showAvoid ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {showAvoid && (
                      <ul className="space-y-1.5 transition-all duration-300">
                        {dietPlan.avoid_foods?.map((food, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-center gap-2 bg-slate-900/60 px-3 py-2 rounded-xl border border-dark-border/40 hover:border-rose-500/30 transition">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                            <span>{food}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="bg-dark-card border border-dark-border rounded-3xl p-12 text-center shadow-xl flex flex-col items-center justify-center min-h-[400px]">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-primary/10 border border-brand-primary/30 text-brand-primary mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <Sparkles className="h-8 w-8" />
              </div>
              <h4 className="text-xl font-bold text-white">No Nutrition Blueprint Generated</h4>
              <p className="mt-2 text-xs text-slate-400 max-w-sm">
                Fill in your physiological markers on the left form and click "Generate Nutrition Blueprint" to calculate your customized plan.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
