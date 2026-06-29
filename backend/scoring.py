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
        
    # BMI and Weight Variance %
    height_m = height / 100.0 if height > 0 else 1.70
    bmi = weight_kg / (height_m ** 2) if height_m > 0 else 22.0
    ideal_weight = 22.0 * (height_m ** 2)

    if bmi > 24.9:
        var_pct = ((weight_kg - ideal_weight) / ideal_weight) * 100.0
        weight_variance_str = f"-{var_pct:.1f}%"
        weight_variance_status = "Overweight"
    elif bmi < 18.5:
        var_pct = ((ideal_weight - weight_kg) / ideal_weight) * 100.0
        weight_variance_str = f"-{var_pct:.1f}%"
        weight_variance_status = "Underweight"
    else:
        weight_variance_str = "0.0%"
        weight_variance_status = "Optimal Weight"

    # Daily Step Target % based on BMI
    if bmi >= 25.0:
        target_steps = 10000
    elif bmi < 18.5:
        target_steps = 7000
    else:
        target_steps = 8000

    steps_pct = min(100.0, (steps / target_steps) * 100.0) if target_steps > 0 else 0.0
    step_target_str = f"{steps_pct:.0f}%"
    step_target_status = f"Target: {target_steps:,} steps"

    return {
        "bmr": bmr,
        "tdee": tdee,
        "bmi": round(bmi, 1),
        "weight_variance_str": weight_variance_str,
        "weight_variance_status": weight_variance_status,
        "step_target_str": step_target_str,
        "step_target_status": step_target_status,
        "current_steps": steps,
        "target_steps": target_steps,
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
    
    # Calculate target calories directly from TDEE and Activity Level
    if needs_weight_loss:
        total_cal = int(tdee_target * 0.85)  # Caloric deficit for healthy weight management
    elif scores["body_fat_status"] == "Underfat":
        total_cal = int(tdee_target * 1.10)  # Caloric surplus for healthy gain
    else:
        total_cal = int(tdee_target)  # Maintenance
        
    total_cal = max(1200, min(4500, total_cal))
    
    # Calculate macro distribution to align with total calories
    p_g = int(weight_kg * protein_factor)
    p_cal = p_g * 4
    rem_cal = max(400, total_cal - p_cal)
    
    if is_diabetic_risk or "fatty liver" in issues_lower:
        c_g = int((rem_cal * 0.35) / 4)
        f_g = int((rem_cal * 0.65) / 9)
    elif has_cholesterol_risk:
        c_g = int((rem_cal * 0.70) / 4)
        f_g = int((rem_cal * 0.30) / 9)
    else:
        c_g = int((rem_cal * 0.55) / 4)
        f_g = int((rem_cal * 0.45) / 9)
    
    meal_plan = generate_meal_options(total_cal, recommended_foods, avoid_foods, is_diabetic_risk, has_cholesterol_risk)
    
    return {
        "calculated_metrics": {
            "weight_variance_str": scores["weight_variance_str"],
            "weight_variance_status": scores["weight_variance_status"],
            "step_target_str": scores["step_target_str"],
            "step_target_status": scores["step_target_status"],
            "bmi": scores["bmi"],
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
        "meal_plan": meal_plan[0],
        "meal_plan_options": meal_plan
    }

def generate_meal_options(calories: int, recommended: List[str], avoid: List[str], low_carb: bool, low_fat: bool) -> List[Dict[str, str]]:
    if low_carb:
        return [
            {
                "name": "Option 1 (Keto / High Protein)",
                "breakfast": "Scrambled Egg Whites (3) or Tofu scramble with spinach, sautéed mushrooms, and half an avocado. Season with pepper and turmeric.",
                "lunch": "Grilled Salmon or Lemon Herb Tempeh served over a bed of Quinoa with steamed broccoli, asparagus, and mixed leafy greens.",
                "snacks": "A handful of raw almonds (10-12) or walnuts, paired with a cup of unsweetened Greek yogurt topped with fresh blueberries.",
                "dinner": "Baked Chicken Breast or Grilled Seitan with baked zucchini slices, cauliflower mash, and a mixed cucumber-tomato salad."
            },
            {
                "name": "Option 2 (Metabolic Reset)",
                "breakfast": "Spinach & Feta Egg Omelet (2 eggs + 2 whites) with sliced tomatoes and a cup of matcha green tea.",
                "lunch": "Mediterranean Turkey or Chickpea Salad Bowl with cucumber, kalamata olives, bell peppers, and extra virgin olive oil.",
                "snacks": "Celery sticks with 2 tbsp almond butter and pumpkin seeds.",
                "dinner": "Grilled Herb Cod or Paneer Skewers with roasted Brussels sprouts and sautéed kale in garlic oil."
            },
            {
                "name": "Option 3 (Clean Lean Muscle)",
                "breakfast": "Chia seed pudding made with almond milk, scoop of whey/plant protein, and fresh raspberries.",
                "lunch": "Avocado & Tuna or Tempeh lettuce wraps with cherry tomatoes and a side of roasted cauliflower florets.",
                "snacks": "2 hard-boiled eggs with a pinch of black pepper and sea salt.",
                "dinner": "Pan-seared Garlic Steak strips or Grilled Tofu with steamed green beans and mashed avocado salad."
            },
            {
                "name": "Option 4 (Low-GI Vitality)",
                "breakfast": "Smoked Salmon or Sautéed Mushrooms on flaxseed crackers with avocado mash and microgreens.",
                "lunch": "Chicken or Lentil & Vegetable Stew seasoned with rosemary, thyme, garlic, and turmeric.",
                "snacks": "Handful of macadamia nuts and roasted pumpkin seeds.",
                "dinner": "Grilled Shrimp or Seitan Fajita Bowl (no tortillas) with sautéed peppers, onions, guacamole, and salsa."
            },
            {
                "name": "Option 5 (Paleo / Clean Green)",
                "breakfast": "Green Smoothie (kale, spinach, protein powder, flaxseeds, almond milk, half avocado).",
                "lunch": "Beef or Black Bean Chili with diced tomatoes, bell peppers, kidney beans, and cilantro.",
                "snacks": "Sliced bell pepper strips with 3 tbsp fresh homemade guacamole.",
                "dinner": "Lemon Baked Halibut or Tofu Steak with asparagus spears and a side of lemon-dressed arugula."
            },
            {
                "name": "Option 6 (Cardio Protection)",
                "breakfast": "Poached eggs (2) over sautéed spinach and garlic with grilled portobello mushroom caps.",
                "lunch": "Grilled Chicken Caesar or Tofu salad with kale, shaved almonds, and olive oil vinaigrette.",
                "snacks": "Unsweetened cottage cheese or coconut yogurt with flaxseeds.",
                "dinner": "Baked Trout or Edamame Bowl with stir-fried bok choy, zucchini noodles, and sesame seeds."
            },
            {
                "name": "Option 7 (Weekend Refresh)",
                "breakfast": "Almond Flour Protein Pancakes (2 small) topped with fresh strawberry puree.",
                "lunch": "Roasted Turkey or Lentil patties with a large Mediterranean garden salad.",
                "snacks": "Handful of unsalted pecans and a cup of chamomile tea.",
                "dinner": "Grilled Lean Sirloin or Seitan Kebabs with grilled bell peppers and zucchini skewers."
            }
        ]
    elif low_fat:
        return [
            {
                "name": "Option 1 (Heart Healthy)",
                "breakfast": "Oatmeal cooked in skimmed or fortified plant milk, topped with sliced bananas, flaxseeds, and a sprinkle of cinnamon.",
                "lunch": "Lentil Soup with a large bowl of green salad (cucumbers, carrots, bell peppers) and boiled chicken breast (no oil) or boiled chickpea chaat.",
                "snacks": "One medium apple with a tablespoon of peanut butter, or roasted chickpeas (without salt/oil).",
                "dinner": "Steamed cod or grilled tofu wrapped in lettuce leaves, served with brown rice and stir-fried vegetables in a low-sodium soy sauce."
            },
            {
                "name": "Option 2 (Lipid Lowering)",
                "breakfast": "Whole grain toast (1 slice) with mashed banana, chia seeds, and a glass of freshly squeezed orange juice.",
                "lunch": "Black bean & corn salad with lime-cilantro dressing, paired with steamed brown rice and baked tofu.",
                "snacks": "Air-popped popcorn (no butter) or rice cakes with sliced cucumber.",
                "dinner": "Baked chicken breast (skinless) or Lentil stew with steamed carrots, green peas, and quinoa."
            },
            {
                "name": "Option 3 (High Fiber Power)",
                "breakfast": "Smoothie bowl with frozen mixed berries, banana, spinach, and skim milk topped with rolled oats.",
                "lunch": "Minestrone soup rich in beans, zucchini, tomatoes, and whole-wheat pasta.",
                "snacks": "Fresh watermelon slices or a pear.",
                "dinner": "Steamed white fish or Edamame served with steamed jasmine rice and stir-fried snow peas."
            },
            {
                "name": "Option 4 (Digestive Cleanse)",
                "breakfast": "Buckwheat or Quinoa porridge cooked in almond milk with diced peaches and chia seeds.",
                "lunch": "Warm Chickpea & Spinach salad with pomegranate seeds and lemon juice vinaigrette.",
                "snacks": "Baked sweet potato wedges (oil-free) with sea salt.",
                "dinner": "Grilled Lean Turkey burger patty or Seitan patty on a bed of steamed kale and roasted beets."
            },
            {
                "name": "Option 5 (Endurance Fuel)",
                "breakfast": "Whole grain cereal with skim milk, sliced strawberries, and a hard-boiled egg white.",
                "lunch": "Grilled Veggie & Hummus Wrap (whole wheat tortilla) with carrots, cucumber, and lettuce.",
                "snacks": "Cup of fresh pineapple chunks or grapes.",
                "dinner": "Poached Salmon fillet or Tofu with steamed wild rice, green beans, and roasted squash."
            },
            {
                "name": "Option 6 (Low Cholesterol)",
                "breakfast": "Egg white omelet (3 whites) with tomatoes, bell peppers, and mushrooms, plus 1 slice whole wheat toast.",
                "lunch": "Yellow dal (lentil tadka with minimal oil) with brown rice and cucumber raita.",
                "snacks": "Handful of dried figs or apricots.",
                "dinner": "Baked Haddock or Tofu skewers with steamed cauliflower mash and sautéed spinach."
            },
            {
                "name": "Option 7 (Light Recovery)",
                "breakfast": "Overnight oats with chia seeds, almond milk, and grated green apple.",
                "lunch": "Barley & Vegetable soup with a side salad dressed in balsamic vinegar.",
                "snacks": "Sliced orange or grapefruit half.",
                "dinner": "Steamed chicken breast tenderloins or boiled chickpeas with steamed broccoli and red quinoa."
            }
        ]
    else:
        return [
            {
                "name": "Option 1 (Balanced Optimal)",
                "breakfast": "2 Whole Eggs poached on a slice of multi-grain toast, paired with a side of mixed berries and green tea.",
                "lunch": "Chicken Breast / Paneer stir-fry with bell peppers, onions, and broccoli, served with a small bowl of wild rice.",
                "snacks": "A protein shake or a handful of mixed nuts (walnuts, almonds) and a piece of dark chocolate (85%+).",
                "dinner": "Baked Turkey Meatballs or Lentil Pasta in a home-made tomato basil sauce, with a large mixed side salad."
            },
            {
                "name": "Option 2 (Performance Boost)",
                "breakfast": "Greek yogurt bowl with granola, honey, chia seeds, and fresh kiwi slices.",
                "lunch": "Turkey or Tempeh avocado wrap with whole-wheat tortilla, spinach, and garlic hummus.",
                "snacks": "Edamame pods lightly salted with sea salt.",
                "dinner": "Grilled Salmon steak with roasted asparagus and sweet potato mash."
            },
            {
                "name": "Option 3 (Mediterranean Diet)",
                "breakfast": "Avocado toast with hemp seeds, poached egg, and cherry tomatoes.",
                "lunch": "Greek Salad with grilled chicken breast or halloumi, olives, cucumber, feta cheese, and olive oil.",
                "snacks": "Apple slices dipped in almond butter.",
                "dinner": "Baked Sea Bass or Paneer tikka with quinoa pilaf and roasted Mediterranean vegetables."
            },
            {
                "name": "Option 4 (Lean Athletic)",
                "breakfast": "Protein oatmeal with banana slices, peanut butter, and cinnamon.",
                "lunch": "Lean beef steak or Seitan bowl with jasmine rice, steamed broccoli, and teriyaki glaze.",
                "snacks": "Cottage cheese with pineapple chunks.",
                "dinner": "Pan-seared cod or Tofu with roasted red potatoes and steamed asparagus."
            },
            {
                "name": "Option 5 (Nutrient Dense)",
                "breakfast": "Vegetable & cheese omelet with a side of grapefruit half and herbal tea.",
                "lunch": "Quinoa power bowl with roasted chickpeas, roasted sweet potato, kale, and tahini dressing.",
                "snacks": "Handful of trail mix (almonds, raisins, pumpkin seeds).",
                "dinner": "Roasted chicken thighs (skinless) or Paneer kebabs with sautéed green beans and wild rice."
            },
            {
                "name": "Option 6 (Vitality Active)",
                "breakfast": "Scrambled eggs (2) with sautéed mushrooms, spinach, and 1 slice sourdough toast.",
                "lunch": "Brown rice sushi bowl with salmon or tofu, avocado, cucumber, edamame, and sesame dressing.",
                "snacks": "Protein bar or handful of mixed berries and walnuts.",
                "dinner": "Grilled Lamb chops or Grilled Tempeh with roasted carrots and garlic kale."
            },
            {
                "name": "Option 7 (Chef's Special Variety)",
                "breakfast": "Spinach & ricotta stuffed crepe or egg wrap with fresh orange juice.",
                "lunch": "Mexican Burrito Bowl with chicken or black beans, guacamole, brown rice, and pico de gallo.",
                "snacks": "Sliced pear with pumpkin seeds.",
                "dinner": "Baked Trout or Grilled Tofu with quinoa, steamed asparagus, and lemon butter sauce."
            }
        ]
