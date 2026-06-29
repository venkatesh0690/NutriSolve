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
  const [showRecommended, setShowRecommended] = useState(false);
  const [showAvoid, setShowAvoid] = useState(false);

  const renderBullets = (text, dotColor = 'bg-brand-primary') => {
    if (!text) return null;
    // Split text cleanly by bullets, periods followed by space, or semicolons
    let items = text.split(/(?:•|;|\n|\.\s+)/).map(s => s.trim()).filter(Boolean);
    // Remove trailing periods from individual items
    items = items.map(item => item.replace(/\.$/, '').trim()).filter(Boolean);
    
    if (items.length === 0) return null;
    return (
      <ul className="space-y-2 mt-2.5">
        {items.map((item, idx) => (
          <li key={idx} className="text-xs text-slate-200 flex items-start gap-2.5 leading-relaxed font-normal bg-slate-950/40 p-2 rounded-xl border border-white/5">
            <span className={`h-2 w-2 rounded-full ${dotColor} mt-1 shrink-0 shadow-[0_0_8px_currentColor]`} />
            <span className="capitalize">{item}</span>
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
      
      {/* Reference Inspired Hero Banner */}
      <div className="mb-10 text-center relative overflow-hidden glass-panel rounded-3xl p-8 sm:p-12 border border-teal-500/20 shadow-xl">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-12 -mb-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        
        <span className="inline-flex items-center gap-2 rounded-full bg-teal-500/10 px-4 py-1.5 text-xs font-black text-teal-400 border border-teal-500/20 mb-4 shadow-sm">
          <Sparkles className="h-4 w-4 text-teal-400" /> AI Clinical Nutrition &amp; Macro Engine
        </span>
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
          Eat Smarter, Live Stronger, <br />
          <span className="bg-gradient-to-r from-teal-300 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Feel Happier Everyday
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base font-medium text-slate-300 leading-relaxed">
          Enter your physiological, blood, and metabolic markers to calculate a clinical, multi-variable nutritional blueprint tailored to your exact metabolic needs.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Metric collection form */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />
          
          <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <Scale className="h-5 w-5 text-orange-500" /> Physiological &amp; Metabolic Markers
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
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <Flame className="h-3 w-3 text-amber-400" /> Daily Target Calories
                      </span>
                    </div>

                    <div className="text-xl font-black text-white mt-1.5">
                      {dietPlan.macros?.calories || 2000} <span className="text-xs font-semibold text-slate-400">kcal/day</span>
                    </div>

                    <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
                      Calculated Target
                    </span>
                  </div>

                  {/* Daily Step Target Card */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <Activity className="h-3 w-3 text-brand-primary" /> Daily Step Goal
                      </span>
                    </div>

                    <div className="text-xl font-black text-brand-primary mt-1.5">
                      {dietPlan.calculated_metrics?.step_target_str || '100%'} <span className="text-xs font-semibold text-slate-400">completed</span>
                    </div>

                    <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded border bg-brand-primary/10 text-brand-primary border-brand-primary/20">
                      {dietPlan.calculated_metrics?.step_target_status || 'BMI Target: 10,000 steps'}
                    </span>
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
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="glass-card p-4 rounded-2xl border-l-4 border-l-brand-primary shadow-lg hover:border-brand-primary/40 transition duration-300">
                    <span className="text-[10px] font-extrabold uppercase text-brand-primary tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-brand-primary animate-pulse shadow-[0_0_8px_#10b981]" /> 🌅 Breakfast Blueprint
                    </span>
                    {renderBullets(dietPlan.meal_plan?.breakfast, 'bg-brand-primary')}
                  </div>

                  <div className="glass-card p-4 rounded-2xl border-l-4 border-l-emerald-400 shadow-lg hover:border-emerald-400/40 transition duration-300">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" /> 🍽️ Lunch Blueprint
                    </span>
                    {renderBullets(dietPlan.meal_plan?.lunch, 'bg-emerald-400')}
                  </div>

                  <div className="glass-card p-4 rounded-2xl border-l-4 border-l-amber-400 shadow-lg hover:border-amber-400/40 transition duration-300">
                    <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]" /> 🍎 Evening Snack
                    </span>
                    {renderBullets(dietPlan.meal_plan?.snacks, 'bg-amber-400')}
                  </div>

                  <div className="glass-card p-4 rounded-2xl border-l-4 border-l-cyan-400 shadow-lg hover:border-cyan-400/40 transition duration-300">
                    <span className="text-[10px] font-extrabold uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" /> 🌙 Dinner Blueprint
                    </span>
                    {renderBullets(dietPlan.meal_plan?.dinner, 'bg-cyan-400')}
                  </div>
                </div>

                {/* Recommended vs Avoid Foods (Collapsed Default + / -) */}
                <div className="grid gap-5 md:grid-cols-2 border-t border-white/10 pt-6">
                  {/* Recommended Clean Foods */}
                  <div className="space-y-3 glass-card p-4 rounded-2xl border border-white/10 hover:border-emerald-500/30 transition duration-300">
                    <div 
                      onClick={() => setShowRecommended(!showRecommended)}
                      className="flex items-center justify-between cursor-pointer select-none group"
                    >
                      <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" /> Recommended Clean Foods
                      </span>
                      <button 
                        type="button"
                        className="h-7 w-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500/20 transition shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                      >
                        {showRecommended ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>

                    {showRecommended && (
                      <ul className="space-y-2 pt-1 transition-all duration-300">
                        {dietPlan.recommended_foods?.map((food, i) => (
                          <li key={i} className="text-xs text-slate-200 flex items-center gap-2.5 bg-slate-950/50 px-3.5 py-2 rounded-xl border border-white/5 hover:border-emerald-500/40 transition">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_#34d399]" />
                            <span className="font-medium">{food}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Foods & Ingredients to Avoid */}
                  <div className="space-y-3 glass-card p-4 rounded-2xl border border-white/10 hover:border-rose-500/30 transition duration-300">
                    <div 
                      onClick={() => setShowAvoid(!showAvoid)}
                      className="flex items-center justify-between cursor-pointer select-none group"
                    >
                      <span className="text-xs font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Foods &amp; Ingredients to Avoid
                      </span>
                      <button 
                        type="button"
                        className="h-7 w-7 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center group-hover:bg-rose-500/20 transition shadow-[0_0_10px_rgba(244,63,94,0.15)]"
                      >
                        {showAvoid ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>

                    {showAvoid && (
                      <ul className="space-y-2 pt-1 transition-all duration-300">
                        {dietPlan.avoid_foods?.map((food, i) => (
                          <li key={i} className="text-xs text-slate-200 flex items-center gap-2.5 bg-slate-950/50 px-3.5 py-2 rounded-xl border border-white/5 hover:border-rose-500/40 transition">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0 shadow-[0_0_6px_#fb7185]" />
                            <span className="font-medium">{food}</span>
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
