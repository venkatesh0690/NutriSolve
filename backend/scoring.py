import math
from typing import Dict, Any, List

def calculate_bmr(weight_kg: float, height_cm: float, age: int, sex: str) -> float:
    """
    Calculate Basal Metabolic Rate (BMR) using the Mifflin-St Jeor equation.
    Female: 10*w + 6.25*h - 5*a - 161
    Male: 10*w + 6.25*h - 5*a + 5
    """
    if not sex or not isinstance(sex, str):
        sex = "Male"
    if not age or age <= 0:
        age = 30
    if not weight_kg or weight_kg <= 0:
        weight_kg = 70.0
    if not height_cm or height_cm <= 0:
        height_cm = 170.0

    if sex.lower() == "female":
        return (10.0 * weight_kg) + (6.25 * height_cm) - (5.0 * age) - 161.0
    else:
        return (10.0 * weight_kg) + (6.25 * height_cm) - (5.0 * age) + 5.0

def get_activity_multiplier(activity_level: str) -> float:
    """
    Returns TDEE activity multiplier based on activity level.
    """
    if not activity_level:
        return 1.200
    al = str(activity_level).lower()
    if "light" in al or "1.375" in al:
        return 1.375
    elif "moderate" in al or "1.55" in al:
        return 1.550
    return 1.200  # Sedentary default

def compute_health_scores(metrics: Dict[str, Any], sex: str, age: int = 30) -> Dict[str, Any]:
    """
    Ingests raw health metrics and evaluates categories, returns status classifications.
    """
    if not sex or not isinstance(sex, str):
        sex = "Male"
    weight_kg = metrics.get("weight_kg", 70.0)
    height = metrics.get("height_cm", 170.0)
    body_fat = metrics.get("body_fat_pct", 25.0)
    hba1c = metrics.get("hba1c_pct", 5.5)
    glucose = metrics.get("fasting_glucose_mg_dl", 90.0)
    ldl = metrics.get("cholesterol_ldl_mg_dl", 100.0)
    hdl = metrics.get("cholesterol_hdl_mg_dl", 50.0)
    vit_d = metrics.get("vitamin_d_ng_ml", 30.0)
    steps = metrics.get("steps_per_day", 5000)
    activity_level = metrics.get("activity_level", "sedentary")

    bmr = calculate_bmr(weight_kg, height, age, sex)
    multiplier = get_activity_multiplier(activity_level)
    tdee = bmr * multiplier

    # Body Fat %
    bf_status = "Healthy"
    if sex.lower() == "male":
        if body_fat < 8:
            bf_status = "Underfat"
        elif 20 < body_fat <= 25:
            bf_status = "Overweight"
        elif body_fat > 25:
            bf_status = "Obese"
    else:  # Female / Other default
        if body_fat < 21:
            bf_status = "Underfat"
        elif 33 < body_fat <= 39:
            bf_status = "Overweight"
        elif body_fat > 39:
            bf_status = "Obese"
            
    # Metabolic Status (HbA1c & Fasting Glucose)
    metabolic_status = "Normal"
    if hba1c >= 6.5 or glucose >= 126:
        metabolic_status = "Diabetic Range"
    elif 5.7 <= hba1c < 6.5 or 100 <= glucose < 126:
        metabolic_status = "Prediabetic Range"
        
    # Cholesterol Levels
    ldl_status = "Optimal"
    if 100 <= ldl < 130:
        ldl_status = "Near Optimal"
    elif 130 <= ldl < 160:
        ldl_status = "Borderline High"
    elif ldl >= 160:
        ldl_status = "High"
        
    hdl_status = "Normal"
    if sex.lower() == "male" and hdl < 40:
        hdl_status = "Low"
    elif sex.lower() != "male" and hdl < 50:
        hdl_status = "Low"
        
    # Vitamin D
    vit_d_status = "Sufficient"
    if vit_d < 20:
        vit_d_status = "Deficient"
    elif 20 <= vit_d < 30:
        vit_d_status = "Insufficient"
        
    # BMR Status
    bmr_status = "Optimal Rate"
    if bmr < 1200:
        bmr_status = "Low Rate"
    elif bmr > 1800:
        bmr_status = "High Rate"

    return {
        "bmr": bmr,
        "bmr_status": bmr_status,
        "tdee": tdee,
        "activity_multiplier": multiplier,
        "body_fat_status": bf_status,
        "metabolic_status": metabolic_status,
        "ldl_status": ldl_status,
        "hdl_status": hdl_status,
        "vit_d_status": vit_d_status
    }

def generate_optimized_diet_plan(metrics: Dict[str, Any], sex: str, active_issues: str, family_history: str, weight_kg: float = 70.0, age: int = 30) -> Dict[str, Any]:
    """
    Maps health scores and active issues into the Dietary Optimization Logic Matrix.
    Outputs: calories, macro splits, recommendations, foods to avoid, and a meal plan.
    """
    if not sex or not isinstance(sex, str):
        sex = "Male"
    if not weight_kg or weight_kg <= 0:
        weight_kg = metrics.get("weight_kg", 70.0)
        
    scores = compute_health_scores(metrics, sex, age)
    
    # Use TDEE as calorie anchor
    tdee_target = scores["tdee"]
    base_calories = tdee_target
    
    protein_pct = 0.25
    carb_pct = 0.50
    fat_pct = 0.25
    
    recommended_foods = ["Lean Proteins (Chicken, Tofu, Tempeh)", "Leafy Greens", "Mixed Berries"]
    avoid_foods = ["Refined Sugar", "Trans Fats", "Sugary Sodas"]
    
    issues_lower = active_issues.lower() if active_issues else ""
    history_lower = family_history.lower() if family_history else ""
    
    # Adjust for Body Fat / Weight Management
    needs_weight_loss = (
        scores["body_fat_status"] in ["Overweight", "Obese"] or
        "weight loss" in issues_lower or
        "obesity" in history_lower
    )
    
    if needs_weight_loss:
        base_calories -= 400.0  # Safe deficit from TDEE
        protein_pct = 0.35      # High protein to preserve muscle
        carb_pct = 0.35         # Controlled carbs
        fat_pct = 0.30
        recommended_foods.extend(["Greek Yogurt", "Egg Whites", "Chia Seeds", "Cruciferous Vegetables"])
        avoid_foods.extend(["White Rice", "Maida (Refined Flour)", "Processed Snacks"])
        
    # Adjust for Metabolic Status (HbA1c & Fasting Glucose)
    is_diabetic_risk = scores["metabolic_status"] in ["Diabetic Range", "Prediabetic Range"] or "diabetic" in issues_lower or "diabetes" in issues_lower
    if is_diabetic_risk:
        carb_pct = min(carb_pct, 0.30)
        protein_pct = max(protein_pct, 0.35)
        fat_pct = 1.0 - (carb_pct + protein_pct)
        recommended_foods.extend(["Avocado", "Quinoa", "Spinach", "Walnuts", "Cinnamon"])
        avoid_foods.extend(["Fruit Juices", "Refined Flour", "White Bread", "White Potatoes", "Honey / Maple Syrup"])
        
    # Adjust for Cholesterol
    has_cholesterol_risk = scores["ldl_status"] in ["Borderline High", "High"] or "cholesterol" in issues_lower or "heart" in history_lower
    if has_cholesterol_risk:
        fat_pct = min(fat_pct, 0.25)
        protein_pct = max(protein_pct, 0.30)
        carb_pct = 1.0 - (fat_pct + protein_pct)
        recommended_foods.extend(["Oats / Oatmeal", "Olive Oil", "Salmon / Mackerel", "Flaxseeds", "Garlic"])
        avoid_foods.extend(["Butter", "Cheese", "Deep Fried Foods", "Palm Oil", "Red Meat"])
        
    # Adjust for Vitamin D
    if scores["vit_d_status"] in ["Deficient", "Insufficient"]:
        recommended_foods.extend(["Vitamin D Fortified Milk", "Egg Yolks", "Mushrooms (UV exposed)", "Salmon / Sardines"])
        
    if "hypertension" in issues_lower or "blood pressure" in issues_lower:
        recommended_foods.extend(["Bananas (Potassium)", "Beetroot", "Celery", "Hibiscus Tea"])
        avoid_foods.extend(["High-Sodium Processed Foods", "Pickles", "Canned Soups", "Table Salt (Excess)"])
        
    recommended_foods = list(dict.fromkeys(recommended_foods))
    avoid_foods = list(dict.fromkeys(avoid_foods))
    
    # Calculate macro targets based on body weight (g/kg)
    protein_factor = 1.0
    if scores["body_fat_status"] in ["Overweight", "Obese"]:
        protein_factor += 0.2
    if is_diabetic_risk:
        protein_factor += 0.3
    if "fatty liver" in issues_lower:
        protein_factor += 0.3
    if "hypertension" in issues_lower or "blood pressure" in issues_lower:
        protein_factor += 0.1
        
    protein_factor = max(0.8, min(1.8, protein_factor))
    
    carb_factor = 3.0
    if needs_weight_loss:
        carb_factor -= 0.5
    if is_diabetic_risk:
        carb_factor -= 0.7
    if "fatty liver" in issues_lower:
        carb_factor -= 0.5
        
    carb_factor = max(1.5, min(4.0, carb_factor))
    
    fat_factor = 0.8
    if has_cholesterol_risk:
        fat_factor -= 0.2
    if "fatty liver" in issues_lower:
        fat_factor -= 0.1
        
    fat_factor = max(0.5, min(1.2, fat_factor))
    
    p_g = int(weight_kg * protein_factor)
    c_g = int(weight_kg * carb_factor)
    f_g = int(weight_kg * fat_factor)
    
    total_cal = int(p_g * 4 + c_g * 4 + f_g * 9)
    
    meal_plan = generate_meal_options(total_cal, recommended_foods, avoid_foods, is_diabetic_risk, has_cholesterol_risk)
    
    return {
        "calculated_metrics": {
            "bmr": round(scores["bmr"], 1),
            "bmr_status": scores["bmr_status"],
            "tdee": round(scores["tdee"], 0),
            "body_fat_status": scores["body_fat_status"],
            "metabolic_status": scores["metabolic_status"],
            "ldl_status": scores["ldl_status"],
            "hdl_status": scores["hdl_status"],
            "vit_d_status": scores["vit_d_status"]
        },
        "macros": {
            "calories": total_cal,
            "protein_g": p_g,
            "carb_g": c_g,
            "fat_g": f_g
        },
        "recommended_foods": recommended_foods,
        "avoid_foods": avoid_foods,
        "meal_plan": meal_plan
    }

def generate_meal_options(calories: int, recommended: List[str], avoid: List[str], low_carb: bool, low_fat: bool) -> Dict[str, str]:
    if low_carb:
        breakfast = "Scrambled Egg Whites (3) or Tofu scramble with spinach, sautéed mushrooms, and half an avocado. Season with pepper, turmeric, and a dash of nutritional yeast."
        lunch = "Grilled Salmon or Lemon Herb Tempeh served over a bed of Quinoa with steamed broccoli, asparagus, and a side of mixed leafy greens dressed in olive oil and lemon juice."
        snacks = "A handful of raw almonds (10-12) or walnuts, paired with a cup of unsweetened Greek yogurt topped with fresh blueberries."
        dinner = "Baked Chicken Breast or Grilled Seitan with baked zucchini slices, cauliflower mash, and a mixed cucumber-tomato salad."
    elif low_fat:
        breakfast = "Oatmeal cooked in skimmed or fortified plant milk, topped with sliced bananas, flaxseeds, and a sprinkle of cinnamon."
        lunch = "Lentil Soup with a large bowl of green salad (cucumbers, carrots, bell peppers) and boiled chicken breast (no oil) or boiled chickpea chaat."
        snacks = "One medium apple with a tablespoon of peanut butter, or roasted chickpeas (without salt/oil)."
        dinner = "Steamed cod or grilled tofu wrapped in lettuce leaves, served with brown rice and stir-fried vegetables in a low-sodium soy sauce."
    else:
        breakfast = "2 Whole Eggs poached on a slice of multi-grain toast, paired with a side of mixed berries and green tea."
        lunch = "Chicken Breast / Paneer stir-fry with bell peppers, onions, and broccoli, served with a small bowl of wild rice."
        snacks = "A protein shake or a handful of mixed nuts (walnuts, almonds) and a piece of dark chocolate (85%+)."
        dinner = "Baked Turkey Meatballs or Lentil Pasta in a home-made tomato basil sauce, with a large mixed side salad."
        
    return {
        "breakfast": breakfast,
        "lunch": lunch,
        "snacks": snacks,
        "dinner": dinner
    }
