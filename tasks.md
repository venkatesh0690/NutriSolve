# Task Checklist - Phase 2 Enhancements

## Phase 1: Database Migration & Backend Updates
- [x] Add `carb_g` to SQL models & implement migration logic in `backend/database.py`
- [x] Update Gemini prompts and mock fallbacks to include carbohydrates in `backend/agents.py`
- [x] Implement new `/api/calendar` endpoint and update analytics compliance formulas in `backend/main.py`
- [x] Test the backend changes and database migration

## Phase 2: Frontend Layout Refactoring
- [x] Modify `frontend/src/pages/ProfilePage.jsx` to expand the graph to full screen
- [x] Position profile specifications in compact top-right boxes
- [x] Draw the maximum calorie level line in the SVG graph
- [x] Build the gamified Star Rating Target Panel on the profile page

## Phase 3: Daily Tracker Calendar & Details Report
- [x] Implement the monthly calendar grid view in `frontend/src/pages/DailyTrackerPage.jsx`
- [x] Add the detailed Daily Food Intake report overlay displaying carb, protein, fiber, and calories per logged food
- [x] Add the 5-star quality rating display for daily consumption scores
- [x] Update the global header rings to display calorie-based compliance
