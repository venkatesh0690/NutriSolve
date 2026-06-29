import os
import shutil
import datetime
import hashlib
import secrets
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Header, Request
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
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

# Password hashing utilities
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return f"{salt}:{pw_hash}"

def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash or ":" not in stored_hash:
        return False
    salt, original_hash = stored_hash.split(":", 1)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return pw_hash == original_hash

# Authentication Dependency
def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    user_id = None
    if x_user_id and x_user_id.isdigit():
        user_id = int(x_user_id)
    elif authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token.isdigit():
            user_id = int(token)
            
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            return user
            
    # Fallback to default demo user for guest compatibility
    user = db.query(User).first()
    if not user:
        user = User(
            name="Aravind",
            email="aravind@example.com",
            password_hash="",
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

# Pydantic Schemas
class UserSignup(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class ProfileUpdate(BaseModel):
    name: str
    age: int
    height_cm: float
    weight_kg: float
    sex: str
    target_calories: int
    star_target: int

class MetricsInput(BaseModel):
    weight_kg: float
    height_cm: float
    body_fat_pct: float
    hba1c_pct: float
    fasting_glucose_mg_dl: float
    cholesterol_ldl_mg_dl: float
    cholesterol_hdl_mg_dl: float
    vitamin_d_ng_ml: float
    waist_cm: Optional[float] = 0.0
    steps_per_day: Optional[int] = 5000
    activity_level: Optional[str] = "sedentary"
    active_issues: Optional[str] = ""
    family_history: Optional[str] = ""

# In-memory rate limiting tracking
RATE_LIMIT_STORE = {}
MAX_AUTH_ATTEMPTS = 5  # Max 5 signup/login requests
RATE_LIMIT_WINDOW = 60  # per 60 seconds

def check_rate_limit(ip: str):
    import time
    now = time.time()
    if ip not in RATE_LIMIT_STORE:
        RATE_LIMIT_STORE[ip] = []
    
    # Filter out timestamps older than window
    RATE_LIMIT_STORE[ip] = [ts for ts in RATE_LIMIT_STORE[ip] if now - ts < RATE_LIMIT_WINDOW]
    
    if len(RATE_LIMIT_STORE[ip]) >= MAX_AUTH_ATTEMPTS:
        raise HTTPException(
            status_code=429, 
            detail="Too many authentication requests. Please wait a minute before trying again."
        )
    
    RATE_LIMIT_STORE[ip].append(now)

def claim_orphaned_data(target_user_id: int, db: Session):
    try:
        from sqlalchemy import or_
        db.query(IntakeLog).filter(or_(IntakeLog.user_id == None, IntakeLog.user_id == 1)).update({IntakeLog.user_id: target_user_id}, synchronize_session=False)
        db.query(DailyIntake).filter(or_(DailyIntake.user_id == None, DailyIntake.user_id == 1)).update({DailyIntake.user_id: target_user_id}, synchronize_session=False)
        db.query(HealthMetrics).filter(or_(HealthMetrics.user_id == None, HealthMetrics.user_id == 1)).update({HealthMetrics.user_id: target_user_id}, synchronize_session=False)
        db.query(DietPlan).filter(or_(DietPlan.user_id == None, DietPlan.user_id == 1)).update({DietPlan.user_id: target_user_id}, synchronize_session=False)
        db.commit()
    except Exception as e:
        db.rollback()

# ─── Auth Endpoints ───
@app.post("/api/auth/signup")
def signup(data: UserSignup, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(client_ip)

    email_clean = data.email.strip().lower()
    if not email_clean or not data.password.strip():
        raise HTTPException(status_code=400, detail="Email and password are required")
        
    if len(data.password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
        
    user = User(
        name=data.name.strip() or "User",
        email=email_clean,
        password_hash=hash_password(data.password.strip()),
        age=28,
        height_cm=175.0,
        weight_kg=72.0,
        sex="Male",
        target_calories=2000,
        star_target=100
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    claim_orphaned_data(user.id, db)

    return {
        "success": True,
        "token": str(user.id),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "target_calories": user.target_calories
        }
    }

@app.post("/api/auth/login")
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(client_ip)

    email_clean = data.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(data.password.strip(), user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")
        
    claim_orphaned_data(user.id, db)

    return {
        "success": True,
        "token": str(user.id),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "target_calories": user.target_calories
        }
    }

# ─── Admin & Database Inspection Endpoints ───
@app.get("/api/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_logs = db.query(IntakeLog).count()
    total_daily = db.query(DailyIntake).count()
    users_list = [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email or "Guest/Legacy",
            "created_at": u.created_at.isoformat() if u.created_at else None
        } for u in db.query(User).all()
    ]
    return {
        "total_accounts": total_users,
        "total_meal_logs": total_logs,
        "total_daily_records": total_daily,
        "accounts": users_list
    }

# ─── User Profile Endpoints ───
@app.get("/api/profile")
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@app.put("/api/profile")
def update_profile(
    profile: ProfileUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.name = profile.name
    current_user.age = profile.age
    current_user.height_cm = profile.height_cm
    current_user.weight_kg = profile.weight_kg
    current_user.sex = profile.sex
    current_user.target_calories = profile.target_calories
    current_user.star_target = profile.star_target
    
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/api/metrics")
def submit_metrics(
    metrics: MetricsInput, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        metrics_dict = metrics.dict()
        sex = current_user.sex if (current_user and current_user.sex) else "Male"
        age = current_user.age if (current_user and current_user.age) else 30
        active_issues = metrics.active_issues or ""
        family_history = metrics.family_history or ""
        
        weight_kg = metrics.weight_kg if metrics.weight_kg > 0 else (current_user.weight_kg if current_user and current_user.weight_kg > 0 else 70.0)
        current_user.weight_kg = weight_kg
        current_user.height_cm = metrics.height_cm
        
        result = generate_optimized_diet_plan(metrics_dict, sex, active_issues, family_history, weight_kg, age)
        
        db_metrics = HealthMetrics(
            user_id=current_user.id,
            weight_kg=weight_kg,
            height_cm=metrics.height_cm,
            body_fat_pct=metrics.body_fat_pct,
            hba1c_pct=metrics.hba1c_pct,
            fasting_glucose_mg_dl=metrics.fasting_glucose_mg_dl,
            cholesterol_ldl_mg_dl=metrics.cholesterol_ldl_mg_dl,
            cholesterol_hdl_mg_dl=metrics.cholesterol_hdl_mg_dl,
            vitamin_d_ng_ml=metrics.vitamin_d_ng_ml,
            steps_per_day=metrics.steps_per_day or 5000,
            activity_level=metrics.activity_level or "sedentary",
            active_issues=active_issues,
            family_history=family_history,
            bmr=result["calculated_metrics"].get("bmr", 0.0),
            tdee=result["calculated_metrics"].get("tdee", 0.0),
            waist_cm=metrics.waist_cm or 0.0,
            bri=0.0,
            whtr=0.0
        )
        db.add(db_metrics)
        
        db_diet = DietPlan(
            user_id=current_user.id,
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
        
        current_user.target_calories = result["macros"]["calories"]
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
def get_latest_diet_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    latest_plan = db.query(DietPlan).filter(DietPlan.user_id == current_user.id).order_by(DietPlan.created_at.desc()).first()
    latest_metrics = db.query(HealthMetrics).filter(HealthMetrics.user_id == current_user.id).order_by(HealthMetrics.created_at.desc()).first()
    
    if not latest_plan:
        return {"has_plan": False}
        
    import ast
    try:
        rec_foods = ast.literal_eval(latest_plan.recommended_foods)
    except:
        rec_foods = []
        
    try:
        avd_foods = ast.literal_eval(latest_plan.avoid_foods)
    except:
        avd_foods = []
        
    calc_metrics = {}
    if latest_metrics:
        m_dict = {
            "weight_kg": latest_metrics.weight_kg,
            "height_cm": latest_metrics.height_cm,
            "body_fat_pct": latest_metrics.body_fat_pct,
            "hba1c_pct": latest_metrics.hba1c_pct,
            "fasting_glucose_mg_dl": latest_metrics.fasting_glucose_mg_dl,
            "cholesterol_ldl_mg_dl": latest_metrics.cholesterol_ldl_mg_dl,
            "cholesterol_hdl_mg_dl": latest_metrics.cholesterol_hdl_mg_dl,
            "vitamin_d_ng_ml": latest_metrics.vitamin_d_ng_ml,
            "steps_per_day": latest_metrics.steps_per_day,
            "activity_level": latest_metrics.activity_level
        }
        from scoring import compute_health_scores
        scores = compute_health_scores(m_dict, current_user.sex or "Male", current_user.age or 30)
        calc_metrics = {
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
        }
        
    return {
        "has_plan": True,
        "metrics": latest_metrics,
        "calculated_metrics": calc_metrics,
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

# ─── Daily Intake Endpoints ───
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today_str = date_str if date_str else datetime.date.today().isoformat()
    
    image_path = ""
    image_bytes = None
    if image_file:
        timestamp_str = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{timestamp_str}_{image_file.filename}"
        dest_path = os.path.join(UPLOAD_DIR, filename)
        
        image_bytes = await image_file.read()
        await image_file.seek(0)
        
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
    
    if not any(meals.values()):
        if text_input:
            meals["General"] = text_input
        elif image_file:
            meals["General"] = "Photo Logged"
            
    existing_logs = db.query(IntakeLog).filter(IntakeLog.user_id == current_user.id, IntakeLog.date == today_str).all()
    existing_logs_map = {l.meal_type: l for l in existing_logs}
    
    is_empty_submission = not any(meals.values())
    
    if is_empty_submission:
        if existing_logs:
            for l in existing_logs:
                db.delete(l)
            daily = db.query(DailyIntake).filter(DailyIntake.user_id == current_user.id, DailyIntake.date == today_str).first()
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
            current_image_bytes = None
            current_image_path = ""
            if image_file and not image_used:
                current_image_bytes = image_bytes
                current_image_path = image_path
                image_used = True
                
            try:
                deduced_items, macros = await process_food_log(meal_text_clean, current_image_bytes)
            except Exception as e:
                from agents import generate_mock_agent_a, generate_mock_agent_b
                deduced_items = generate_mock_agent_a(meal_text_clean, current_image_bytes is not None)
                macros = generate_mock_agent_b(deduced_items)
                
            if existing_log:
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
                log = IntakeLog(
                    user_id=current_user.id,
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
            if existing_log:
                db.delete(existing_log)
                
    db.commit()
    
    all_logs = db.query(IntakeLog).filter(IntakeLog.user_id == current_user.id, IntakeLog.date == today_str).all()
    
    total_calories = sum(l.calories for l in all_logs)
    total_protein = sum(l.protein_g for l in all_logs)
    total_carb = sum(l.carb_g for l in all_logs)
    total_fiber = sum(l.fiber_g for l in all_logs)
    total_flagged = sum(l.flagged_g for l in all_logs)
    
    daily = db.query(DailyIntake).filter(DailyIntake.date == today_str).first()
    if all_logs:
        if not daily:
            daily = DailyIntake(
                user_id=current_user.id,
                date=today_str,
                calories=total_calories,
                protein_g=total_protein,
                carb_g=total_carb,
                fiber_g=total_fiber,
                flagged_g=total_flagged
            )
            db.add(daily)
        else:
            daily.user_id = current_user.id
            daily.calories = total_calories
            daily.protein_g = total_protein
            daily.carb_g = total_carb
            daily.fiber_g = total_fiber
            daily.flagged_g = total_flagged
    else:
        if daily:
            db.delete(daily)
            
    db.commit()
    
    clean_grams = total_protein + total_fiber
    flagged_grams = total_flagged
    total_g = clean_grams + flagged_grams
    meal_score = (clean_grams / total_g * 100) if total_g > 0 else 100.0
    
    processed_meals = {}
    for l in all_logs:
        try:
            items = json.loads(l.deduced_items)
        except:
            items = []
        processed_meals[l.meal_type] = {
            "deduced_items": items,
            "macros": {
                "calories": round(l.calories, 1),
                "protein_g": round(l.protein_g, 2),
                "carb_g": round(l.carb_g, 2),
                "fiber_g": round(l.fiber_g, 2),
                "flagged_g": round(l.flagged_g, 2)
            }
        }
        
    return {
        "success": True,
        "date": today_str,
        "meals": processed_meals,
        "daily_total": {
            "calories": round(total_calories, 1),
            "protein_g": round(total_protein, 2),
            "carb_g": round(total_carb, 2),
            "fiber_g": round(total_fiber, 2),
            "flagged_g": round(total_flagged, 2)
        },
        "meal_score": round(meal_score, 1)
    }

def get_current_macro_targets(db: Session, user: User):
    weight_kg = user.weight_kg if user else 80.0
    sex = user.sex if user else "Male"
    
    latest_metrics = db.query(HealthMetrics).filter(HealthMetrics.user_id == user.id).order_by(HealthMetrics.created_at.desc()).first()
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
def get_analytics(
    local_date: Optional[str] = None, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    targets = get_current_macro_targets(db, current_user)
    target_calories = targets["calories"]
    
    if current_user and current_user.target_calories != target_calories:
        current_user.target_calories = target_calories
        db.commit()
        
    today_str = local_date if local_date else datetime.date.today().isoformat()
    daily = db.query(DailyIntake).filter(DailyIntake.user_id == current_user.id, DailyIntake.date == today_str).first()
    
    today_calories = daily.calories if daily else 0.0
    daily_score = 0.0
    if target_calories > 0 and today_calories > 0:
        ratio = today_calories / target_calories
        if ratio <= 1.0:
            daily_score = ratio * 100.0
        else:
            daily_score = max(0.0, 100.0 - (ratio - 1.0) * 100.0)
        
    base_date = datetime.date.fromisoformat(today_str)
    weekly_scores = []
    for i in range(7):
        date_check = (base_date - datetime.timedelta(days=i)).isoformat()
        day_record = db.query(DailyIntake).filter(DailyIntake.user_id == current_user.id, DailyIntake.date == date_check).first()
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
def get_history(
    local_date: Optional[str] = None, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_calories = current_user.target_calories if current_user else 2000.0
    
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
        
        day_record = db.query(DailyIntake).filter(DailyIntake.user_id == current_user.id, DailyIntake.date == date_str).first()
        if day_record:
            stars = calculate_stars_for_day(day_record, target_calories)
            history.append({
                "date": date_str,
                "label": label,
                "has_data": True,
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
                "has_data": False,
                "healthy_g": 0,
                "unhealthy_g": 0,
                "carb_g": 0,
                "calories": 0,
                "stars": 0
            })
            
    return history

@app.get("/api/calendar")
def get_calendar_view(
    local_date: Optional[str] = None, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    targets = get_current_macro_targets(db, current_user)
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
        
        day_record = db.query(DailyIntake).filter(DailyIntake.user_id == current_user.id, DailyIntake.date == date_str).first()
        logs = db.query(IntakeLog).filter(IntakeLog.user_id == current_user.id, IntakeLog.date == date_str).order_by(IntakeLog.timestamp.asc()).all()
        
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
                    "calories": round(l.calories, 1),
                    "protein_g": round(l.protein_g, 2),
                    "carb_g": round(l.carb_g, 2),
                    "fiber_g": round(l.fiber_g, 2),
                    "flagged_g": round(l.flagged_g, 2),
                    "items": items
                }
            else:
                existing = detailed_meals[l.meal_type]
                existing["text"] += "; " + (l.text_input or "")
                existing["calories"] = round(existing["calories"] + l.calories, 1)
                existing["protein_g"] = round(existing["protein_g"] + l.protein_g, 2)
                existing["carb_g"] = round(existing["carb_g"] + l.carb_g, 2)
                existing["fiber_g"] = round(existing["fiber_g"] + l.fiber_g, 2)
                existing["flagged_g"] = round(existing["flagged_g"] + l.flagged_g, 2)
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
def get_recent_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = db.query(IntakeLog).filter(IntakeLog.user_id == current_user.id).order_by(IntakeLog.timestamp.desc()).limit(20).all()
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
