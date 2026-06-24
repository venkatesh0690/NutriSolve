import math
from typing import Dict, Any, List

def calculate_bri(waist_cm: float, height_cm: float) -> float:
    """
    Calculate Body Roundness Index (BRI) using height and waist in meters.
    BRI = 364.2 - 365.5 * sqrt(1 - ((waist / (2*pi)) / (0.5 * height))^2)
    """
    waist_m = waist_cm / 100.0
    height_m = height_cm / 100.0
    
    val = (waist_m / (2 * math.pi)) / (0.5 * height_m)
    val_sq = val ** 2
    
    if val_sq >= 1.0:
        return 364.2  # upper bound cap to prevent negative root
        
    return 364.2 - 365.5 * math.sqrt(1 - val_sq)

def compute_health_scores(metrics: Dict[str, Any], sex: str) -> Dict[str, Any]:
    """
    Ingests raw health metrics and evaluates categories, returns status classifications.
    """
    waist = metrics["waist_cm"]
    height = metrics["height_cm"]
    body_fat = metrics["body_fat_pct"]
    hba1c = metrics["hba1c_pct"]
    glucose = metrics["fasting_glucose_mg_dl"]
    ldl = metrics["cholesterol_ldl_mg_dl"]
    hdl = metrics["cholesterol_hdl_mg_dl"]
    vit_d = metrics["vitamin_d_ng_ml"]
    
    whtr = waist / height
    bri = calculate_bri(waist, height)
    
    # 1. Waist-to-Height Ratio (WHtR)
    whtr_status = "Healthy"
    if whtr < 0.4:
        whtr_status = "Extremely Slim"
    elif 0.5 <= whtr < 0.6:
        whtr_status = "Overweight"
    elif whtr >= 0.6:
        whtr_status = "Obese / High Risk"
        
    # 2. Body Roundness Index (BRI)
    bri_status = "Healthy"
    if bri < 3.0:
        bri_status = "Low Roundness / Lean"
    elif 5.0 < bri <= 6.9:
        bri_status = "Moderate Roundness"
    elif bri > 6.9:
        bri_status = "High Roundness"
        
    # 3. Body Fat %
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
            
    # 4. Metabolic Status (HbA1c & Fasting Glucose)
    metabolic_status = "Normal"
    if hba1c >= 6.5 or glucose >= 126:
        metabolic_status = "Diabetic Range"
    elif 5.7 <= hba1c < 6.5 or 100 <= glucose < 126:
        metabolic_status = "Prediabetic Range"
        
    # 5. Cholesterol Levels
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
        
    # 6. Vitamin D
    vit_d_status = "Sufficient"
    if vit_d < 20:
        vit_d_status = "Deficient"
    elif 20 <= vit_d < 30:
        vit_d_status = "Insufficient"
        
    return {
        "whtr": whtr,
        "whtr_status": whtr_status,
        "bri": bri,
        "bri_status": bri_status,
        "body_fat_status": bf_status,
        "metabolic_status": metabolic_status,
        "ldl_status": ldl_status,
        "hdl_status": hdl_status,
        "vit_d_status": vit_d_status
    }

def generate_optimized_diet_plan(metrics: Dict[str, Any], sex: str, active_issues: str, family_history: str, weight_kg: float = 70.0) -> Dict[str, Any]:
    """
    Maps health scores and active issues into the Dietary Optimization Logic Matrix.
    Outputs: calories, macro splits, recommendations, foods to avoid, and a meal plan.
    """
    scores = compute_health_scores(metrics, sex)
    
    # Baseline calculations
    base_calories = 2000.0
    protein_pct = 0.25
    carb_pct = 0.50
    fat_pct = 0.25
    
    recommended_foods = ["Lean Proteins (Chicken, Tofu, Tempeh)", "Leafy Greens", "Mixed Berries"]
    avoid_foods = ["Refined Sugar", "Trans Fats", "Sugary Sodas"]
    
    issues_lower = active_issues.lower() if active_issues else ""
    history_lower = family_history.lower() if family_history else ""
    
    # 1. Adjust for Body Roundness & Overweight (BRI, WHtR, BF%)
    needs_weight_loss = (
        scores["whtr_status"] in ["Overweight", "Obese / High Risk"] or
        scores["bri_status"] in ["Moderate Roundness", "High Roundness"] or
        scores["body_fat_status"] in ["Overweight", "Obese"]
    )
    
    if needs_weight_loss:
        base_calories -= 350.0  # Calorie deficit
        protein_pct = 0.35      # High protein to preserve muscle
        carb_pct = 0.35         # Controlled carbs
        fat_pct = 0.30
        recommended_foods.extend(["Greek Yogurt", "Egg Whites", "Chia Seeds", "Cruciferous Vegetables"])
        avoid_foods.extend(["White Rice", "Maida (Refined Flour)", "Processed Snacks"])
        
    # 2. Adjust for Metabolic Status (HbA1c & Fasting Glucose)
    is_diabetic_risk = scores["metabolic_status"] in ["Diabetic Range", "Prediabetic Range"] or "diabetes" in issues_lower
    if is_diabetic_risk:
        # Strict low glycemic index
        carb_pct = min(carb_pct, 0.30)
        protein_pct = max(protein_pct, 0.35)
        fat_pct = 1.0 - (carb_pct + protein_pct)
        recommended_foods.extend(["Avocado", "Quinoa", "Spinach", "Walnuts", "Cinnamon"])
        avoid_foods.extend(["Fruit Juices", "Refined Flour", "White Bread", "White Potatoes", "Honey / Maple Syrup"])
        
    # 3. Adjust for Cholesterol (LDL / HDL)
    has_cholesterol_risk = scores["ldl_status"] in ["Borderline High", "High"] or "cholesterol" in issues_lower or "heart" in history_lower
    if has_cholesterol_risk:
        fat_pct = min(fat_pct, 0.25)
        # Re-balance other macros
        protein_pct = max(protein_pct, 0.30)
        carb_pct = 1.0 - (fat_pct + protein_pct)
        
        recommended_foods.extend(["Oats / Oatmeal", "Olive Oil", "Salmon / Mackerel", "Flaxseeds", "Garlic"])
        avoid_foods.extend(["Butter", "Cheese", "Deep Fried Foods", "Palm Oil", "Red Meat"])
        
    # 4. Adjust for Vitamin D
    if scores["vit_d_status"] in ["Deficient", "Insufficient"]:
        recommended_foods.extend(["Vitamin D Fortified Milk", "Egg Yolks", "Mushrooms (UV exposed)", "Salmon / Sardines"])
        
    # 5. Specific Health Issue Additions
    if "hypertension" in issues_lower or "blood pressure" in issues_lower:
        recommended_foods.extend(["Bananas (Potassium)", "Beetroot", "Celery", "Hibiscus Tea"])
        avoid_foods.extend(["High-Sodium Processed Foods", "Pickles", "Canned Soups", "Table Salt (Excess)"])
        
    # Final cleanup of food lists (unique elements)
    recommended_foods = list(dict.fromkeys(recommended_foods))
    avoid_foods = list(dict.fromkeys(avoid_foods))
    
    # Calculate macro targets based on body weight (g/kg) and health risk factors
    # 1. Protein factor: baseline 1.0 g/kg. Adjust based on metabolic risk/body fat/fatty liver
    protein_factor = 1.0
    if scores["body_fat_status"] in ["Overweight", "Obese"] or scores["whtr_status"] in ["Overweight", "Obese / High Risk"]:
        protein_factor += 0.2
    if is_diabetic_risk:
        protein_factor += 0.3
    if "fatty liver" in issues_lower:
        protein_factor += 0.3
    if "hypertension" in issues_lower or "blood pressure" in issues_lower:
        protein_factor += 0.1
        
    # Cap protein factor between 0.8 and 1.8 g/kg
    protein_factor = max(0.8, min(1.8, protein_factor))
    
    # 2. Carbohydrates factor: baseline 3.0 g/kg
    carb_factor = 3.0
    if needs_weight_loss:
        carb_factor -= 0.5
    if is_diabetic_risk:
        carb_factor -= 0.7
    if "fatty liver" in issues_lower:
        carb_factor -= 0.5
        
    # Cap carb factor between 1.5 and 4.0 g/kg
    carb_factor = max(1.5, min(4.0, carb_factor))
    
    # 3. Fats factor: baseline 0.8 g/kg
    fat_factor = 0.8
    if has_cholesterol_risk:
        fat_factor -= 0.2
    if "fatty liver" in issues_lower:
        fat_factor -= 0.1
        
    # Cap fat factor between 0.5 and 1.2 g/kg
    fat_factor = max(0.5, min(1.2, fat_factor))
    
    p_g = int(weight_kg * protein_factor)
    c_g = int(weight_kg * carb_factor)
    f_g = int(weight_kg * fat_factor)
    
    # Calculate optimized daily calorie target
    total_cal = int(p_g * 4 + c_g * 4 + f_g * 9)
    
    # Generate structured meal plan based on profiles
    meal_plan = generate_meal_options(total_cal, recommended_foods, avoid_foods, is_diabetic_risk, has_cholesterol_risk)
    
    return {
        "calculated_metrics": {
            "whtr": round(scores["whtr"], 3),
            "whtr_status": scores["whtr_status"],
            "bri": round(scores["bri"], 2),
            "bri_status": scores["bri_status"],
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
    """
    Renders custom healthy meal plan recommendations split by meal sections.
    """
    # Customize meal text based on low_carb or low_fat constraints
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
