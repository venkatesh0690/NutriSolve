import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, Scale, Heart, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { API_BASE } from '../config';

export default function DietPlanPage({ onPlanSubmit }) {
  const [formData, setFormData] = useState({
    waist_cm: '',
    height_cm: '',
    body_fat_pct: '',
    hba1c_pct: '',
    fasting_glucose_mg_dl: '',
    cholesterol_ldl_mg_dl: '',
    cholesterol_hdl_mg_dl: '',
    vitamin_d_ng_ml: '',
    active_issues: '',
    family_history: ''
  });

  const [loading, setLoading] = useState(false);
  const [dietPlan, setDietPlan] = useState(null);
  const [error, setError] = useState('');

  // Fetch the latest plan on mount to show saved baseline data
  useEffect(() => {
    const fetchLatestPlan = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/metrics/latest`);
        if (res.ok) {
          const data = await res.json();
          if (data.has_plan) {
            setDietPlan(data);
            // Pre-fill form from latest saved metrics
            const m = data.metrics;
            setFormData({
              waist_cm: m.waist_cm || '',
              height_cm: m.height_cm || '',
              body_fat_pct: m.body_fat_pct || '',
              hba1c_pct: m.hba1c_pct || '',
              fasting_glucose_mg_dl: m.fasting_glucose_mg_dl || '',
              cholesterol_ldl_mg_dl: m.cholesterol_ldl_mg_dl || '',
              cholesterol_hdl_mg_dl: m.cholesterol_hdl_mg_dl || '',
              vitamin_d_ng_ml: m.vitamin_d_ng_ml || '',
              active_issues: m.active_issues || '',
              family_history: m.family_history || ''
            });
          }
        }
      } catch (err) {
        console.error('Failed to load latest plan:', err);
      }
    };
    fetchLatestPlan();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Simple verification
    const requiredKeys = [
      'waist_cm',
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
        setError('Please fill in all metrics before calculating.');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waist_cm: parseFloat(formData.waist_cm),
          height_cm: parseFloat(formData.height_cm),
          body_fat_pct: parseFloat(formData.body_fat_pct),
          hba1c_pct: parseFloat(formData.hba1c_pct),
          fasting_glucose_mg_dl: parseFloat(formData.fasting_glucose_mg_dl),
          cholesterol_ldl_mg_dl: parseFloat(formData.cholesterol_ldl_mg_dl),
          cholesterol_hdl_mg_dl: parseFloat(formData.cholesterol_hdl_mg_dl),
          vitamin_d_ng_ml: parseFloat(formData.vitamin_d_ng_ml),
          active_issues: formData.active_issues,
          family_history: formData.family_history
        })
      });

      if (!res.ok) {
        throw new Error('Failed to compute scoring plan. Check server logs.');
      }

      const data = await res.json();
      setDietPlan(data);
      onPlanSubmit(); // notify header to refresh metrics
    } catch (err) {
      setError(err.message || 'Server error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const s = status.toLowerCase();
    if (s.includes('healthy') || s.includes('optimal') || s.includes('sufficient') || s.includes('normal')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (s.includes('overweight') || s.includes('borderline') || s.includes('insufficient') || s.includes('near') || s.includes('pre')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
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
          Enter your multi-variable physiological, blood, and metabolic markers to generate an mathematically tailored nutritional blueprint.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Metric collection form */}
        <div className="lg:col-span-5 bg-dark-card border border-dark-border rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-brand-primary/5 blur-3xl" />
          
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Scale className="h-5 w-5 text-brand-primary" /> Physiological & Metabolic Markers
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Waist Circumference (cm)</label>
                <input
                  type="number"
                  name="waist_cm"
                  value={formData.waist_cm}
                  onChange={handleChange}
                  placeholder="e.g. 84"
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
                  placeholder="e.g. 175"
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
                  placeholder="e.g. 18"
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
                  placeholder="e.g. 28"
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

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Active Health Issues</label>
              <input
                type="text"
                name="active_issues"
                value={formData.active_issues}
                onChange={handleChange}
                placeholder="e.g. hypertension, type 2 diabetes, none"
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
              className="w-full bg-brand-primary hover:bg-emerald-400 text-black font-bold py-3 px-4 rounded-xl shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
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
                  <Shield className="h-5 w-5 text-brand-primary" /> Physiological & Blood Diagnostics
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* BRI Card */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Body Roundness Index</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {dietPlan.calculated_metrics?.bri || dietPlan.metrics?.bri}
                    </div>
                    <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(dietPlan.calculated_metrics?.bri_status || 'Healthy')}`}>
                      {dietPlan.calculated_metrics?.bri_status || 'Optimal'}
                    </span>
                  </div>

                  {/* WHtR Card */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Waist-to-Height Ratio</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {dietPlan.calculated_metrics?.whtr || dietPlan.metrics?.whtr}
                    </div>
                    <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(dietPlan.calculated_metrics?.whtr_status || 'Healthy')}`}>
                      {dietPlan.calculated_metrics?.whtr_status || 'Healthy'}
                    </span>
                  </div>

                  {/* Metabolic Status Card */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-dark-border">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Metabolic Status</span>
                    <div className="text-md font-bold text-white mt-2 truncate">
                      {dietPlan.calculated_metrics?.metabolic_status || 'Normal'}
                    </div>
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(dietPlan.calculated_metrics?.metabolic_status || 'Normal')}`}>
                      HbA1c & Glucose
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
                        <span className="block text-[10px] text-slate-500 font-semibold">PRO</span>
                        <span className="font-bold text-slate-200">{dietPlan.macros?.protein_g}g</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 font-semibold">CARB</span>
                        <span className="font-bold text-slate-200">{dietPlan.macros?.carb_g}g</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 font-semibold">FAT</span>
                        <span className="font-bold text-slate-200">{dietPlan.macros?.fat_g}g</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Specific Meals */}
                <div className="space-y-4">
                  {/* Breakfast */}
                  <div className="relative pl-4 border-l-2 border-brand-primary">
                    <span className="text-xs font-bold text-brand-primary uppercase tracking-wide">Breakfast Option</span>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                      {dietPlan.meal_plan?.breakfast}
                    </p>
                  </div>

                  {/* Lunch */}
                  <div className="relative pl-4 border-l-2 border-brand-secondary">
                    <span className="text-xs font-bold text-brand-secondary uppercase tracking-wide">Lunch Option</span>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                      {dietPlan.meal_plan?.lunch}
                    </p>
                  </div>

                  {/* Snacks */}
                  <div className="relative pl-4 border-l-2 border-amber-400">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Mid-day Snack Option</span>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                      {dietPlan.meal_plan?.snacks}
                    </p>
                  </div>

                  {/* Dinner */}
                  <div className="relative pl-4 border-l-2 border-indigo-400">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Dinner Option</span>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                      {dietPlan.meal_plan?.dinner}
                    </p>
                  </div>
                </div>

                {/* Dietary Inclusions / Exclusions Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-dark-border/60">
                  {/* Clean foods list */}
                  <div className="bg-emerald-500/5 rounded-2xl border border-emerald-500/10 p-4">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <CheckCircle className="h-4 w-4" /> Targeted Clean Foods
                    </span>
                    <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                      {dietPlan.recommended_foods?.map((food, i) => (
                        <li key={i} className="leading-snug">{food}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Avoid foods list */}
                  <div className="bg-rose-500/5 rounded-2xl border border-rose-500/10 p-4">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <AlertTriangle className="h-4 w-4" /> Flagged Foods to Avoid
                    </span>
                    <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                      {dietPlan.avoid_foods?.map((food, i) => (
                        <li key={i} className="leading-snug">{food}</li>
                      ))}
                    </ul>
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="bg-dark-card border border-dark-border rounded-3xl p-10 shadow-xl flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <HelpCircle className="h-16 w-16 text-slate-600 mb-4 stroke-1 animate-pulse" />
              <h4 className="text-lg font-bold text-slate-300">No Nutrition Blueprint Available</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Submit the diagnostics form on the left to calculate and display your personalized health scores and optimized dietary meal plans.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
