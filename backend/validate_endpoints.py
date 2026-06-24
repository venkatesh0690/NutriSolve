import datetime
import json
from database import init_db, SessionLocal, User, HealthMetrics, DietPlan, DailyIntake, IntakeLog

def validate_db_flow():
    print("Initializing Database...")
    init_db()
    
    db = SessionLocal()
    try:
        print("Checking default user...")
        user = db.query(User).first()
        if user:
            print(f"User exists: {user.name}, Target Calories: {user.target_calories}")
            
        print("Inserting sample daily intake data...")
        today_str = datetime.date.today().isoformat()
        
        # Cleanup today's records if any
        db.query(DailyIntake).filter(DailyIntake.date == today_str).delete()
        db.query(IntakeLog).filter(IntakeLog.date == today_str).delete()
        
        # Log a healthy item (e.g. egg whites and salad)
        healthy_log = IntakeLog(
            date=today_str,
            text_input="Had boiled egg whites and a green salad",
            deduced_items=json.dumps([
                {"item": "Egg whites", "type": "clean", "notes": "high protein"},
                {"item": "Green salad", "type": "clean", "notes": "high fiber"}
            ]),
            calories=120.0,
            protein_g=18.0,
            fiber_g=4.0,
            flagged_g=0.0
        )
        db.add(healthy_log)
        
        # Log an unhealthy/flagged item (e.g. sweet soda)
        unhealthy_log = IntakeLog(
            date=today_str,
            text_input="Had a sugary soda and some maida cookies",
            deduced_items=json.dumps([
                {"item": "Sugary soda", "type": "flagged", "notes": "refined sugar"},
                {"item": "Maida cookies", "type": "flagged", "notes": "refined flour"}
            ]),
            calories=350.0,
            protein_g=1.0,
            fiber_g=0.5,
            flagged_g=80.0
        )
        db.add(unhealthy_log)
        
        # Update daily aggregate
        daily_record = DailyIntake(
            date=today_str,
            calories=470.0,
            protein_g=19.0,
            fiber_g=4.5,
            flagged_g=80.0
        )
        db.add(daily_record)
        db.commit()
        print("Logged sample intake and committed successfully.")
        
        # Verify calculation
        daily = db.query(DailyIntake).filter(DailyIntake.date == today_str).first()
        clean_g = daily.protein_g + daily.fiber_g
        total_g = clean_g + daily.flagged_g
        daily_score = (clean_g / total_g) * 100.0
        print(f"Aggregated daily stats for {today_str}:")
        print(f"  Calories: {daily.calories} kcal")
        print(f"  Protein: {daily.protein_g}g")
        print(f"  Fiber: {daily.fiber_g}g")
        print(f"  Flagged: {daily.flagged_g}g")
        print(f"  Healthy Consumption %: {daily_score:.1f}%")
        
        assert daily_score > 0, "Score calculation failed"
        print("Database flow validation completed successfully!")
        
    finally:
        db.close()

if __name__ == "__main__":
    validate_db_flow()
