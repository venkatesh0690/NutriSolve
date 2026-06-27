import os
import shutil
import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal, init_db, User, HealthMetrics, DietPlan, DailyIntake, IntakeLog
from scoring import generate_optimized_diet_plan
from agents import process_food_log

# Initialize Database on startup
init_db()

app = FastAPI(title="Health & Diet API")

# Setup CORS so React frontend can call it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify front-end origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads directory exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.abspath(os.path.join(BASE_DIR, "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Schemas
class ProfileUpdate(BaseModel):
    name: str
    age: int
    height_cm: float
    weight_kg: float
    sex: str
    target_calories: int
    star_target: int

class MetricsInput(BaseModel):
    waist_cm: float
    height_cm: float
    body_fat_pct: float
    hba1c_pct: float
    fasting_glucose_mg_dl: float
    cholesterol_ldl_mg_dl: float
    cholesterol_hdl_mg_dl: float
    vitamin_d_ng_ml: float
    active_issues: str
    family_history: str

@app.get("/api/profile")
def get_profile(db: Session = Depends(get_db)):
    user = db.query(User).first()
    if not user:
        user = User(
            name="Aravind",
            age=28,
            height_cm=175.0,
            weight_kg=72.0,
            sex="Male",
            target_calories=2100,
            star_target=100
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@app.put("/api/profile")
def update_profile(profile: ProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(User).first()
    if not user:
        user = User()
        db.add(user)
    
    user.name = profile.name
    user.age = profile.age
    user.height_cm = profile.height_cm
    user.weight_kg = profile.weight_kg
    user.sex = profile.sex
    user.target_calories = profile.target_calories
    user.star_target = profile.star_target
    
    db.commit()
    db.refresh(user)
    return user

@app.post("/api/metrics")
def submit_metrics(metrics: MetricsInput, db: Session = Depends(get_db)):
    user = db.query(User).first()
    if not user:
        user = User(
            name="Aravind",
            age=28,
            height_cm=175.0,
            weight_kg=72.0,
            sex="Male",
            target_calories=2100,
            star_target=100
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    try:
        # 1. Run scoring engine
        metrics_dict = metrics.dict()
        sex = user.sex if (user and user.sex) else "Male"
        active_issues = metrics.active_issues
        family_history = metrics.family_history
        
        weight_kg = user.weight_kg if (user and user.weight_kg and user.weight_kg > 0) else 70.0
        result = generate_optimized_diet_plan(metrics_dict, sex, active_issues, family_history, weight_kg)
        
        # 2. Persist HealthMetrics record
        db_metrics = HealthMetrics(
            waist_cm=metrics.waist_cm,
            height_cm=metrics.height_cm,
            body_fat_pct=metrics.body_fat_pct,
            hba1c_pct=metrics.hba1c_pct,
            fasting_glucose_mg_dl=metrics.fasting_glucose_mg_dl,
            cholesterol_ldl_mg_dl=metrics.cholesterol_ldl_mg_dl,
            cholesterol_hdl_mg_dl=metrics.cholesterol_hdl_mg_dl,
            vitamin_d_ng_ml=metrics.vitamin_d_ng_ml,
            active_issues=active_issues,
            family_history=family_history,
            bri=result["calculated_metrics"]["bri"],
            whtr=result["calculated_metrics"]["whtr"]
        )
        db.add(db_metrics)
        
        # 3. Persist DietPlan record
        db_diet = DietPlan(
            calories=result["macros"]["calories"],
            protein_g=result["macros"]["protein_g"],
            carb_g=result["macros"]["carb_g"],
            fat_g=result["macros"]["fat_g"],
            meal_breakfast=result["meal_plan"]["breakfast"],
            meal_lunch=result["meal_plan"]["lunch"],
            meal_snacks=result["meal_plan"]["snacks"],
            meal_dinner=result["meal_plan"]["dinner"],
            recommended_foods=str(result["recommended_foods"]),
            avoid_foods=str(result["avoid_foods"])
        )
        db.add(db_diet)
        
        # 4. Update user's target calories based on recommendation
        user.target_calories = result["macros"]["calories"]
        
        db.commit()
        return result
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.error("Error generating optimized diet plan:")
        logger.error(traceback.format_exc())
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.get("/api/metrics/latest")
def get_latest_diet_plan(db: Session = Depends(get_db)):
    latest_plan = db.query(DietPlan).order_by(DietPlan.created_at.desc()).first()
    latest_metrics = db.query(HealthMetrics).order_by(HealthMetrics.created_at.desc()).first()
    
    if not latest_plan:
        return {"has_plan": False}
        
    # Evaluate list formats
    import ast
    try:
        rec_foods = ast.literal_eval(latest_plan.recommended_foods)
    except:
        rec_foods = []
        
    try:
        avd_foods = ast.literal_eval(latest_plan.avoid_foods)
    except:
        avd_foods = []
        
    return {
        "has_plan": True,
        "metrics": latest_metrics,
        "macros": {
            "calories": latest_plan.calories,
            "protein_g": latest_plan.protein_g,
            "carb_g": latest_plan.carb_g,
            "fat_g": latest_plan.fat_g
        },
        "recommended_foods": rec_foods,
        "avoid_foods": avd_foods,
        "meal_plan": {
            "breakfast": latest_plan.meal_breakfast,
            "lunch": latest_plan.meal_lunch,
            "snacks": latest_plan.meal_snacks,
            "dinner": latest_plan.meal_dinner
        }
    }

@app.post("/api/intake")
async def log_intake(
    date_str: Optional[str] = Form(None),
    breakfast: str = Form(""),
    morning_snack: str = Form(""),
    lunch: str = Form(""),
    evening_snack: str = Form(""),
    dinner: str = Form(""),
    text_input: str = Form(""),
    image_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    # Determine the date (use browser local date_str if provided, else server date)
    today_str = date_str if date_str else datetime.date.today().isoformat()
    
    # Save image file if uploaded
    image_path = ""
    image_bytes = None
    if image_file:
        timestamp_str = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{timestamp_str}_{image_file.filename}"
        dest_path = os.path.join(UPLOAD_DIR, filename)
        
        # Read bytes for API parsing
        image_bytes = await image_file.read()
        await image_file.seek(0) # reset stream
        
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(image_file.file, buffer)
        image_path = f"/uploads/{filename}"
        
    meals = {
        "Breakfast": breakfast,
        "Morning Snack": morning_snack,
        "Lunch": lunch,
        "Evening Snack": evening_snack,
        "Dinner": dinner
    }
    
    # Fallback to general input if meal fields are empty but text_input or image is present
    if not any(meals.values()):
        if text_input:
            meals["General"] = text_input
        elif image_file:
            meals["General"] = "Photo Logged"
            
    existing_logs = db.query(IntakeLog).filter(IntakeLog.date == today_str).all()
    existing_logs_map = {l.meal_type: l for l in existing_logs}
    
    # If the user is submitting all empty fields, check if they are trying to clear existing logs
    is_empty_submission = not any(meals.values())
    
    if is_empty_submission:
        if existing_logs:
            # Delete all logs for this date (including any General logs)
            for l in existing_logs:
                db.delete(l)
            # Delete daily aggregate record
            daily = db.query(DailyIntake).filter(DailyIntake.date == today_str).first()
            if daily:
                db.delete(daily)
            db.commit()
            return {
                "success": True,
                "date": today_str,
                "meals": {},
                "daily_total": {
                    "calories": 0.0,
                    "protein_g": 0.0,
                    "carb_g": 0.0,
                    "fiber_g": 0.0,
                    "flagged_g": 0.0
                },
                "meal_score": 100.0
            }
        else:
            raise HTTPException(status_code=400, detail="Provide at least one meal description or upload a photo.")
    
    image_used = False
    import json
    
    for meal_type, meal_text in meals.items():
        meal_text_clean = meal_text.strip()
        existing_log = existing_logs_map.get(meal_type)
        
        if meal_text_clean:
            # Deconstruct and parse each logged meal (new or updated)
            current_image_bytes = None
            current_image_path = ""
            if image_file and not image_used:
                current_image_bytes = image_bytes
                current_image_path = image_path
                image_used = True
                
            try:
                deduced_items, macros = await process_food_log(meal_text_clean, current_image_bytes)
            except Exception as e:
                # If AI fails, proceed with safe mock logic so logging never fails
                from agents import generate_mock_agent_a, generate_mock_agent_b
                deduced_items = generate_mock_agent_a(meal_text_clean, current_image_bytes is not None)
                macros = generate_mock_agent_b(deduced_items)
                
            if existing_log:
                # Update existing log
                existing_log.text_input = meal_text_clean
                existing_log.image_path = current_image_path or existing_log.image_path
                existing_log.deduced_items = json.dumps(deduced_items)
                existing_log.calories = macros["calories"]
                existing_log.protein_g = macros["protein_g"]
                existing_log.carb_g = macros["carb_g"]
                existing_log.fiber_g = macros["fiber_g"]
                existing_log.flagged_g = macros["flagged_g"]
                existing_log.timestamp = datetime.datetime.utcnow()
            else:
                # Insert new log
                log = IntakeLog(
                    date=today_str,
                    text_input=meal_text_clean,
                    image_path=current_image_path,
                    deduced_items=json.dumps(deduced_items),
                    calories=macros["calories"],
                    protein_g=macros["protein_g"],
                    carb_g=macros["carb_g"],
                    fiber_g=macros["fiber_g"],
                    flagged_g=macros["flagged_g"],
                    meal_type=meal_type
                )
                db.add(log)
        else:
            # Text is empty. If it was previously logged, delete it
            if existing_log:
                db.delete(existing_log)
                
    db.commit()
    
    # Recalculate DailyIntake aggregates based on all remaining logs for this date
    all_logs = db.query(IntakeLog).filter(IntakeLog.date == today_str).all()
    
    total_calories = sum(l.calories for l in all_logs)
    total_protein = sum(l.protein_g for l in all_logs)
    total_carb = sum(l.carb_g for l in all_logs)
    total_fiber = sum(l.fiber_g for l in all_logs)
    total_flagged = sum(l.flagged_g for l in all_logs)
    
    daily = db.query(DailyIntake).filter(DailyIntake.date == today_str).first()
    if all_logs:
        if not daily:
            daily = DailyIntake(
                date=today_str,
                calories=total_calories,
                protein_g=total_protein,
                carb_g=total_carb,
                fiber_g=total_fiber,
                flagged_g=total_flagged
            )
            db.add(daily)
        else:
            daily.calories = total_calories
            daily.protein_g = total_protein
            daily.carb_g = total_carb
            daily.fiber_g = total_fiber
            daily.flagged_g = total_flagged
    else:
        if daily:
            db.delete(daily)
            
    db.commit()
    
    # Calculate health score for this batch of meals
    clean_grams = total_protein + total_fiber
    flagged_grams = total_flagged
    total_g = clean_grams + flagged_grams
    meal_score = (clean_grams / total_g * 100) if total_g > 0 else 100.0
    
    # Build list of processed meals
    processed_meals = {}
    for l in all_logs:
        try:
            items = json.loads(l.deduced_items)
        except:
            items = []
        processed_meals[l.meal_type] = {
            "deduced_items": items,
            "macros": {
                "calories": l.calories,
                "protein_g": l.protein_g,
                "carb_g": l.carb_g,
                "fiber_g": l.fiber_g,
                "flagged_g": l.flagged_g
            }
        }
        
    return {
        "success": True,
        "date": today_str,
        "meals": processed_meals,
        "daily_total": {
            "calories": total_calories,
            "protein_g": total_protein,
            "carb_g": total_carb,
            "fiber_g": total_fiber,
            "flagged_g": total_flagged
        },
        "meal_score": round(meal_score, 1)
    }

def get_current_macro_targets(db: Session):
    user = db.query(User).first()
    weight_kg = user.weight_kg if user else 80.0
    sex = user.sex if user else "Male"
    
    latest_metrics = db.query(HealthMetrics).order_by(HealthMetrics.created_at.desc()).first()
    if latest_metrics:
        metrics_dict = {
            "waist_cm": latest_metrics.waist_cm,
            "height_cm": latest_metrics.height_cm,
            "body_fat_pct": latest_metrics.body_fat_pct,
            "hba1c_pct": latest_metrics.hba1c_pct,
            "fasting_glucose_mg_dl": latest_metrics.fasting_glucose_mg_dl,
            "cholesterol_ldl_mg_dl": latest_metrics.cholesterol_ldl_mg_dl,
            "cholesterol_hdl_mg_dl": latest_metrics.cholesterol_hdl_mg_dl,
            "vitamin_d_ng_ml": latest_metrics.vitamin_d_ng_ml
        }
        result = generate_optimized_diet_plan(
            metrics_dict, sex, latest_metrics.active_issues, latest_metrics.family_history, weight_kg
        )
        return {
            "calories": result["macros"]["calories"],
            "protein": result["macros"]["protein_g"],
            "carbs": result["macros"]["carb_g"],
            "fiber": 30,
            "flagged": 15
        }
    else:
        calories = user.target_calories if user else 1650
        return {
            "calories": calories,
            "protein": int(weight_kg * 1.6),
            "carbs": int(weight_kg * 2.0),
            "fiber": 30,
            "flagged": 15
        }

@app.get("/api/analytics")
def get_analytics(local_date: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Computes Daily score percentage based on target calories and Weekly rolling 7-day average.
    Penalizes overconsumption: if intake exceeds target, compliance drops.
    """
    user = db.query(User).first()
    targets = get_current_macro_targets(db)
    target_calories = targets["calories"]
    
    # Sync user target calories in database
    if user and user.target_calories != target_calories:
        user.target_calories = target_calories
        db.commit()
        
    today_str = local_date if local_date else datetime.date.today().isoformat()
    daily = db.query(DailyIntake).filter(DailyIntake.date == today_str).first()
    
    # 1. Daily calorie compliance score (penalizes overconsumption)
    today_calories = daily.calories if daily else 0.0
    daily_score = 0.0
    if target_calories > 0 and today_calories > 0:
        ratio = today_calories / target_calories
        if ratio <= 1.0:
            daily_score = ratio * 100.0
        else:
            daily_score = max(0.0, 100.0 - (ratio - 1.0) * 100.0)
        
    # 2. Weekly rolling average of calorie compliance
    base_date = datetime.date.fromisoformat(today_str)
    weekly_scores = []
    for i in range(7):
        date_check = (base_date - datetime.timedelta(days=i)).isoformat()
        day_record = db.query(DailyIntake).filter(DailyIntake.date == date_check).first()
        if day_record:
            day_calories = day_record.calories
            if target_calories > 0 and day_calories > 0:
                r = day_calories / target_calories
                if r <= 1.0:
                    day_score = r * 100.0
                else:
                    day_score = max(0.0, 100.0 - (r - 1.0) * 100.0)
            else:
                day_score = 0.0
            weekly_scores.append(day_score)
        else:
            weekly_scores.append(0.0)
            
    weekly_score = sum(weekly_scores) / len(weekly_scores) if weekly_scores else 0.0
    
    return {
        "daily_healthy_pct": round(daily_score, 1),
        "weekly_healthy_pct": round(weekly_score, 1),
        "today_calories": round(today_calories, 0),
        "target_calories": target_calories,
        "target_protein": targets["protein"],
        "target_carbs": targets["carbs"],
        "target_fiber": targets["fiber"],
        "target_flagged": targets["flagged"]
    }

def calculate_stars_for_day(day_record, target_calories: float) -> int:
    """
    Calculates star rating out of 5 based on calorie compliance percentage.
    Penalizes both under-eating and over-eating relative to target.
    """
    if not day_record or day_record.calories == 0 or target_calories <= 0:
        return 0
    ratio = day_record.calories / target_calories
    if ratio <= 1.0:
        score = ratio * 100.0
    else:
        score = max(0.0, 100.0 - (ratio - 1.0) * 100.0)
    if score >= 80:
        return 5
    elif score >= 60:
        return 4
    elif score >= 40:
        return 3
    elif score >= 20:
        return 2
    elif score > 0:
        return 1
    return 0

@app.get("/api/history")
def get_history(local_date: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns historical data for the last 7 days, including carbs and stars rating.
    """
    user = db.query(User).first()
    target_calories = user.target_calories if user else 2000.0
    
    if local_date:
        try:
            base_date = datetime.date.fromisoformat(local_date)
        except:
            base_date = datetime.date.today()
    else:
        base_date = datetime.date.today()
    
    history = []
    for i in reversed(range(7)):
        check_date = (base_date - datetime.timedelta(days=i))
        date_str = check_date.isoformat()
        label = check_date.strftime("%a")
        
        day_record = db.query(DailyIntake).filter(DailyIntake.date == date_str).first()
        if day_record:
            stars = calculate_stars_for_day(day_record, target_calories)
            history.append({
                "date": date_str,
                "label": label,
                "healthy_g": round(day_record.protein_g + day_record.fiber_g, 1),
                "unhealthy_g": round(day_record.flagged_g, 1),
                "carb_g": round(day_record.carb_g, 1),
                "calories": round(day_record.calories, 0),
                "stars": stars
            })
        else:
            history.append({
                "date": date_str,
                "label": label,
                "healthy_g": 0.0,
                "unhealthy_g": 0.0,
                "carb_g": 0.0,
                "calories": 0.0,
                "stars": 0
            })
            
    return history

@app.get("/api/calendar")
def get_calendar_view(local_date: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns daily aggregates and details for the last 30 calendar days to render in calendar grid.
    """
    targets = get_current_macro_targets(db)
    target_calories = targets["calories"]
    
    if local_date:
        try:
            base_date = datetime.date.fromisoformat(local_date)
        except:
            base_date = datetime.date.today()
    else:
        base_date = datetime.date.today()
    
    calendar_days = []
    import json
    for i in range(30):
        check_date = (base_date - datetime.timedelta(days=i))
        date_str = check_date.isoformat()
        
        day_record = db.query(DailyIntake).filter(DailyIntake.date == date_str).first()
        
        # Fetch detailed logs for this date and aggregate by meal_type
        logs = db.query(IntakeLog).filter(IntakeLog.date == date_str).order_by(IntakeLog.timestamp.asc()).all()
        detailed_meals = {}
        for l in logs:
            try:
                items = json.loads(l.deduced_items)
            except:
                items = []
            if l.meal_type not in detailed_meals:
                detailed_meals[l.meal_type] = {
                    "id": l.id,
                    "text": l.text_input or "Photo Logged",
                    "image_path": l.image_path,
                    "calories": l.calories,
                    "protein_g": l.protein_g,
                    "carb_g": l.carb_g,
                    "fiber_g": l.fiber_g,
                    "flagged_g": l.flagged_g,
                    "items": items
                }
            else:
                existing = detailed_meals[l.meal_type]
                existing["text"] += "; " + (l.text_input or "")
                existing["calories"] += l.calories
                existing["protein_g"] += l.protein_g
                existing["carb_g"] += l.carb_g
                existing["fiber_g"] += l.fiber_g
                existing["flagged_g"] += l.flagged_g
                existing["items"].extend(items)
            
        if day_record:
            if target_calories > 0:
                ratio = day_record.calories / target_calories
                if ratio <= 1.0:
                    score = ratio * 100.0
                else:
                    score = max(0.0, 100.0 - (ratio - 1.0) * 100.0)
            else:
                score = 0.0
            stars = calculate_stars_for_day(day_record, target_calories)
            calendar_days.append({
                "date": date_str,
                "day_number": check_date.day,
                "month_name": check_date.strftime("%B"),
                "has_data": True,
                "score_pct": round(score, 1),
                "stars": stars,
                "macros": {
                    "calories": round(day_record.calories, 0),
                    "protein_g": round(day_record.protein_g, 1),
                    "carb_g": round(day_record.carb_g, 1),
                    "fiber_g": round(day_record.fiber_g, 1),
                    "flagged_g": round(day_record.flagged_g, 1)
                },
                "meals": detailed_meals
            })
        else:
            calendar_days.append({
                "date": date_str,
                "day_number": check_date.day,
                "month_name": check_date.strftime("%B"),
                "has_data": False,
                "score_pct": 0.0,
                "stars": 0,
                "macros": {
                    "calories": 0.0,
                    "protein_g": 0.0,
                    "carb_g": 0.0,
                    "fiber_g": 0.0,
                    "flagged_g": 0.0
                },
                "meals": {}
            })
            
    return calendar_days

@app.get("/api/logs")
def get_recent_logs(db: Session = Depends(get_db)):
    """
    Returns all raw logs sorted by time.
    """
    logs = db.query(IntakeLog).order_by(IntakeLog.timestamp.desc()).limit(20).all()
    out = []
    import json
    for log in logs:
        try:
            items = json.loads(log.deduced_items)
        except:
            items = []
        out.append({
            "id": log.id,
            "date": log.date,
            "timestamp": log.timestamp.isoformat() if log.timestamp else "",
            "text_input": log.text_input,
            "image_path": log.image_path,
            "deduced_items": items,
            "calories": log.calories,
            "protein_g": log.protein_g,
            "carb_g": log.carb_g,
            "fiber_g": log.fiber_g,
            "flagged_g": log.flagged_g
        })
    return out

# Optional frontend static serving fallback if dist exists
FRONTEND_DIST = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))
if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("uploads/"):
            raise HTTPException(status_code=404, detail="API route not found")
        target = os.path.join(FRONTEND_DIST, full_path)
        if os.path.exists(target) and os.path.isfile(target):
            return FileResponse(target)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Not Found")

