import datetime
import json
import os
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "")

if DATABASE_URL:
    # Render and Heroku return "postgres://" urls. SQLAlchemy 1.4+ requires "postgresql://"
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(
        DATABASE_URL, 
        pool_pre_ping=True, 
        pool_recycle=300, 
        connect_args={"connect_timeout": 15}
    )
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.abspath(os.path.join(BASE_DIR, "health_app.db"))
    DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30.0})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="User")
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=True)
    age = Column(Integer, default=30)
    height_cm = Column(Float, default=175.0)
    weight_kg = Column(Float, default=70.0)
    sex = Column(String, default="Male")  # Male, Female, Other
    target_calories = Column(Integer, default=2000)
    star_target = Column(Integer, default=100)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class HealthMetrics(Base):
    __tablename__ = "health_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    waist_cm = Column(Float, nullable=False)
    height_cm = Column(Float, nullable=False)
    body_fat_pct = Column(Float, nullable=False)
    hba1c_pct = Column(Float, nullable=False)
    fasting_glucose_mg_dl = Column(Float, nullable=False)
    cholesterol_ldl_mg_dl = Column(Float, nullable=False)
    cholesterol_hdl_mg_dl = Column(Float, nullable=False)
    vitamin_d_ng_ml = Column(Float, nullable=False)
    active_issues = Column(String, default="")  # comma separated
    family_history = Column(String, default="")  # comma separated
    
    # Calculated values
    bri = Column(Float, nullable=False)
    whtr = Column(Float, nullable=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class DietPlan(Base):
    __tablename__ = "diet_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    calories = Column(Integer, nullable=False)
    protein_g = Column(Integer, nullable=False)
    carb_g = Column(Integer, nullable=False)
    fat_g = Column(Integer, nullable=False)
    
    # JSON strings of meals or structured text
    meal_breakfast = Column(String, nullable=False)
    meal_lunch = Column(String, nullable=False)
    meal_snacks = Column(String, nullable=False)
    meal_dinner = Column(String, nullable=False)
    
    # Recommended clean foods & foods to avoid
    recommended_foods = Column(String, default="[]")  # JSON list
    avoid_foods = Column(String, default="[]")  # JSON list
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class DailyIntake(Base):
    __tablename__ = "daily_intake"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    date = Column(String, index=True)  # YYYY-MM-DD
    calories = Column(Float, default=0.0)
    protein_g = Column(Float, default=0.0)
    carb_g = Column(Float, default=0.0)
    fiber_g = Column(Float, default=0.0)
    flagged_g = Column(Float, default=0.0)

class IntakeLog(Base):
    __tablename__ = "intake_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    date = Column(String, index=True)  # YYYY-MM-DD
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    text_input = Column(String, default="")
    image_path = Column(String, default="")
    deduced_items = Column(String, default="[]")  # JSON string representation of food items list
    calories = Column(Float, default=0.0)
    protein_g = Column(Float, default=0.0)
    carb_g = Column(Float, default=0.0)
    fiber_g = Column(Float, default=0.0)
    flagged_g = Column(Float, default=0.0)
    meal_type = Column(String, default="General")  # Breakfast, Lunch, etc.

def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        
        # Run migration checks safely for existing installations
        import sqlalchemy as sa
        inspector = sa.inspect(engine)
        
        try:
            # Check columns for users
            user_columns = [col['name'] for col in inspector.get_columns('users')]
            with engine.begin() as conn:
                if 'star_target' not in user_columns:
                    conn.execute(sa.text("ALTER TABLE users ADD COLUMN star_target INTEGER DEFAULT 100"))
                if 'email' not in user_columns:
                    conn.execute(sa.text("ALTER TABLE users ADD COLUMN email VARCHAR"))
                if 'password_hash' not in user_columns:
                    conn.execute(sa.text("ALTER TABLE users ADD COLUMN password_hash VARCHAR"))
                if 'created_at' not in user_columns:
                    conn.execute(sa.text("ALTER TABLE users ADD COLUMN created_at TIMESTAMP"))

            # Check columns for health_metrics
            hm_columns = [col['name'] for col in inspector.get_columns('health_metrics')]
            if 'user_id' not in hm_columns:
                with engine.begin() as conn:
                    conn.execute(sa.text("ALTER TABLE health_metrics ADD COLUMN user_id INTEGER"))

            # Check columns for diet_plans
            dp_columns = [col['name'] for col in inspector.get_columns('diet_plans')]
            if 'user_id' not in dp_columns:
                with engine.begin() as conn:
                    conn.execute(sa.text("ALTER TABLE diet_plans ADD COLUMN user_id INTEGER"))

            # Check columns for daily_intake
            daily_columns = [col['name'] for col in inspector.get_columns('daily_intake')]
            with engine.begin() as conn:
                if 'carb_g' not in daily_columns:
                    conn.execute(sa.text("ALTER TABLE daily_intake ADD COLUMN carb_g FLOAT DEFAULT 0.0"))
                if 'user_id' not in daily_columns:
                    conn.execute(sa.text("ALTER TABLE daily_intake ADD COLUMN user_id INTEGER"))
                    
            # Check columns for intake_logs
            log_columns = [col['name'] for col in inspector.get_columns('intake_logs')]
            with engine.begin() as conn:
                if 'carb_g' not in log_columns:
                    conn.execute(sa.text("ALTER TABLE intake_logs ADD COLUMN carb_g FLOAT DEFAULT 0.0"))
                if 'meal_type' not in log_columns:
                    conn.execute(sa.text("ALTER TABLE intake_logs ADD COLUMN meal_type VARCHAR DEFAULT 'General'"))
                if 'user_id' not in log_columns:
                    conn.execute(sa.text("ALTER TABLE intake_logs ADD COLUMN user_id INTEGER"))
        except Exception as e:
            print(f"Migration error: {str(e)}")

        # Ensure default demo user exists for legacy compatibility
        db = SessionLocal()
        try:
            user = db.query(User).first()
            if not user:
                default_user = User(
                    name="Aravind",
                    email="aravind@example.com",
                    password_hash="",
                    age=28,
                    height_cm=175.0,
                    weight_kg=72.0,
                    sex="Male",
                    target_calories=2100
                )
                db.add(default_user)
                db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"Database initialization failed: {str(e)}")
