import unittest
import math
from scoring import calculate_bri, compute_health_scores, generate_optimized_diet_plan

class TestScoringEngine(unittest.TestCase):
    
    def test_bri_calculation_healthy(self):
        # Height 175cm, Waist 80cm
        bri = calculate_bri(80.0, 175.0)
        # Expected BRI should be around 2.5 - 3.5
        self.assertTrue(2.0 < bri < 4.0, f"Expected BRI between 2 and 4, got {bri}")
        
    def test_bri_calculation_obese(self):
        # Height 170cm, Waist 120cm
        bri = calculate_bri(120.0, 170.0)
        # Expected BRI should be high (e.g. > 7.0)
        self.assertTrue(bri > 6.0, f"Expected BRI > 6 for waist 120cm, height 170cm, got {bri}")
        
    def test_health_scoring_classification_male(self):
        metrics = {
            "waist_cm": 84.0,
            "height_cm": 175.0,
            "body_fat_pct": 14.0,
            "hba1c_pct": 5.4,
            "fasting_glucose_mg_dl": 92.0,
            "cholesterol_ldl_mg_dl": 95.0,
            "cholesterol_hdl_mg_dl": 50.0,
            "vitamin_d_ng_ml": 35.0
        }
        scores = compute_health_scores(metrics, "Male")
        
        self.assertEqual(scores["whtr_status"], "Healthy")
        self.assertEqual(scores["body_fat_status"], "Healthy")
        self.assertEqual(scores["metabolic_status"], "Normal")
        self.assertEqual(scores["ldl_status"], "Optimal")
        self.assertEqual(scores["vit_d_status"], "Sufficient")

    def test_health_scoring_classification_high_risk(self):
        metrics = {
            "waist_cm": 110.0,
            "height_cm": 170.0,
            "body_fat_pct": 28.0,
            "hba1c_pct": 6.8,
            "fasting_glucose_mg_dl": 140.0,
            "cholesterol_ldl_mg_dl": 165.0,
            "cholesterol_hdl_mg_dl": 35.0,
            "vitamin_d_ng_ml": 15.0
        }
        scores = compute_health_scores(metrics, "Male")
        
        self.assertEqual(scores["whtr_status"], "Obese / High Risk")
        self.assertEqual(scores["body_fat_status"], "Obese")
        self.assertEqual(scores["metabolic_status"], "Diabetic Range")
        self.assertEqual(scores["ldl_status"], "High")
        self.assertEqual(scores["vit_d_status"], "Deficient")

    def test_dietary_optimization_matrix(self):
        # High risk inputs should generate lower calories and specific avoid recommendations
        metrics = {
            "waist_cm": 105.0,
            "height_cm": 175.0,
            "body_fat_pct": 27.0,
            "hba1c_pct": 6.0, # prediabetic
            "fasting_glucose_mg_dl": 110.0,
            "cholesterol_ldl_mg_dl": 140.0, # borderline high
            "cholesterol_hdl_mg_dl": 42.0,
            "vitamin_d_ng_ml": 18.0 # deficient
        }
        
        plan = generate_optimized_diet_plan(metrics, "Male", "hypertension", "heart disease")
        
        # Output verification
        self.assertTrue(plan["macros"]["calories"] < 2000, "Should suggest calorie deficit (<2000)")
        self.assertIn("Oats / Oatmeal", plan["recommended_foods"])
        self.assertIn("Salmon / Sardines", plan["recommended_foods"])
        self.assertIn("Maida (Refined Flour)", plan["avoid_foods"])
        self.assertIn("High-Sodium Processed Foods", plan["avoid_foods"])

if __name__ == "__main__":
    unittest.main()
