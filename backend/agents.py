import os
import json
import base64
import logging
import httpx
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger("uvicorn.error")

# Try to get API Key and Model from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# FatSecret Platform API integration credentials
FATSECRET_CLIENT_ID = os.getenv("FATSECRET_CLIENT_ID", "")
FATSECRET_CLIENT_SECRET = os.getenv("FATSECRET_CLIENT_SECRET", "")
_fatsecret_token_cache = {"token": "", "expires_at": 0}

async def get_fatsecret_token() -> str:
    import time
    if not FATSECRET_CLIENT_ID or not FATSECRET_CLIENT_SECRET:
        return ""
    now = time.time()
    if _fatsecret_token_cache["token"] and _fatsecret_token_cache["expires_at"] > now + 60:
        return _fatsecret_token_cache["token"]
        
    url = "https://oauth.fatsecret.com/connect/token"
    data = {"grant_type": "client_credentials", "scope": "basic"}
    auth = (FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, data=data, auth=auth)
            if res.status_code == 200:
                js = res.json()
                _fatsecret_token_cache["token"] = js.get("access_token", "")
                _fatsecret_token_cache["expires_at"] = now + js.get("expires_in", 86400)
                return _fatsecret_token_cache["token"]
    except Exception as e:
        logger.error(f"Failed to authenticate with FatSecret OAuth: {str(e)}")
    return ""

async def search_fatsecret_nutrition(query: str) -> Optional[Dict[str, float]]:
    token = await get_fatsecret_token()
    if not token:
        return None
    url = "https://platform.fatsecret.com/rest/server.api"
    params = {
        "method": "foods.search",
        "search_expression": query,
        "format": "json"
    }
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, params=params, headers=headers)
            if res.status_code == 200:
                js = res.json()
                foods = js.get("foods", {}).get("food", [])
                if isinstance(foods, list) and len(foods) > 0:
                    first_food = foods[0]
                elif isinstance(foods, dict):
                    first_food = foods
                else:
                    return None
                    
                desc = first_food.get("food_description", "")
                import re
                cal_m = re.search(r'Calories:\s*([\d\.]+)kcal', desc, re.IGNORECASE)
                pro_m = re.search(r'Protein:\s*([\d\.]+)g', desc, re.IGNORECASE)
                carb_m = re.search(r'Carbs:\s*([\d\.]+)g', desc, re.IGNORECASE)
                fat_m = re.search(r'Fat:\s*([\d\.]+)g', desc, re.IGNORECASE)
                
                cal = float(cal_m.group(1)) if cal_m else 100.0
                pro = float(pro_m.group(1)) if pro_m else 2.0
                carb = float(carb_m.group(1)) if carb_m else 20.0
                return {"cal": cal, "pro": pro, "carb": carb, "fib": 1.0, "flg": 0.0}
    except Exception as e:
        logger.error(f"FatSecret search error: {str(e)}")
    return None

async def call_gemini_api(prompt: str, user_text: str = "", image_bytes: bytes = None, mime_type: str = "image/jpeg") -> str:
    """
    Helper function to call Gemini API directly using httpx with JSON schema enforcement.
    """
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY environment variable is not set. Falling back to mock parsing.")
        return ""
        
    url = f"https://generativelanguagetool.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    parts = []
    
    # 1. System Prompt + Instructions
    parts.append({"text": prompt})
    
    # 2. User Text
    if user_text:
        parts.append({"text": f"User Input Description: {user_text}"})
        
    # 3. User Image (multimodal)
    if image_bytes:
        encoded_image = base64.b64encode(image_bytes).decode("utf-8")
        parts.append({
            "inlineData": {
                "mimeType": mime_type,
                "data": encoded_image
            }
        })
        
    payload = {
        "contents": [{
            "parts": parts
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                result = response.json()
                # Extract text response from Gemini format
                text_out = result["candidates"][0]["content"]["parts"][0]["text"]
                return text_out.strip()
            else:
                logger.error(f"Gemini API returned error code {response.status_code}: {response.text}")
                # Try fallback model if 2.5-flash fails or is not available
                if GEMINI_MODEL == "gemini-2.5-flash":
                    logger.info("Attempting fallback to gemini-1.5-flash...")
                    fallback_url = f"https://generativelanguagetool.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
                    response = await client.post(fallback_url, json=payload, headers=headers)
                    if response.status_code == 200:
                        return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                return ""
    except Exception as e:
        logger.error(f"Failed to communicate with Gemini API: {str(e)}")
        return ""

def generate_mock_agent_a(text_input: str, has_image: bool) -> List[Dict[str, Any]]:
    """
    Fallback mock parser for Agent A when Gemini API key is missing or fails.
    Deduces items based on simple text keywords.
    Splits compound food logs (e.g. "X and Y", "A with B") into multiple sub-items.
    """
    import re
    text_lower = text_input.lower() if text_input else ""
    items = []
    
    # NLP Parsing rule logic
    raw_sub_items = []
    if text_input:
        # Split by "with", "and", "plus", ",", ";"
        parts = re.split(r'\s+with\s+|\s+and\s+|\s+plus\s+|,|;', text_input, flags=re.IGNORECASE)
        raw_sub_items = [p.strip() for p in parts if p.strip()]
    
    for sub_item in raw_sub_items:
        sub_lower = sub_item.lower()
        
        if "biryani" in sub_lower:
            if "only ate the chicken" in sub_lower or "only ate chicken" in sub_lower:
                items.append({
                    "item": "Chicken pieces (from Biryani)",
                    "type": "clean",
                    "notes": "Ate only chicken, excluded rice"
                })
                items.append({
                    "item": "Rice portion (from Biryani)",
                    "type": "flagged",
                    "notes": "Leftover, not consumed"
                })
            else:
                items.append({
                    "item": sub_item,
                    "type": "flagged",
                    "notes": "Contains refined rice and oil"
                })
        elif "chicken" in sub_lower:
            items.append({
                "item": sub_item,
                "type": "clean",
                "notes": "High protein food"
            })
        elif "egg" in sub_lower or "eggs" in sub_lower:
            items.append({
                "item": sub_item,
                "type": "clean",
                "notes": "Lean protein"
            })
        elif "salad" in sub_lower:
            items.append({
                "item": sub_item,
                "type": "clean",
                "notes": "High fiber"
            })
        elif "sweet" in sub_lower or "sugar" in sub_lower or "coke" in sub_lower or "soda" in sub_lower:
            items.append({
                "item": sub_item,
                "type": "flagged",
                "notes": "Refined sugars detected"
            })
        elif "maida" in sub_lower or "bread" in sub_lower:
            items.append({
                "item": sub_item,
                "type": "flagged",
                "notes": "Refined starch"
            })
        elif "dosa" in sub_lower:
            items.append({
                "item": sub_item,
                "type": "clean",
                "notes": "Lentil & rice crepe"
            })
        elif "chapati" in sub_lower or "roti" in sub_lower:
            items.append({
                "item": sub_item,
                "type": "clean",
                "notes": "Whole wheat bread"
            })
        elif "paneer" in sub_lower:
            items.append({
                "item": sub_item,
                "type": "clean",
                "notes": "Cottage cheese"
            })
        elif "rice" in sub_lower:
            items.append({
                "item": sub_item,
                "type": "flagged",
                "notes": "Refined starch"
            })
        else:
            if sub_item:
                items.append({
                    "item": sub_item,
                    "type": "clean",
                    "notes": "Generic item fallback"
                })
                
    if not items:
        # Generic food fallback
        if has_image:
            items.append({
                "item": "Mixed Plate (Parsed from Image)",
                "type": "clean",
                "notes": "Clean visual parsing fallback"
            })
        else:
            items.append({
                "item": text_input if text_input else "Standard Meal",
                "type": "clean",
                "notes": "Generic item fallback"
            })
            
    return items


def scrape_calories_from_search(food_name: str) -> Optional[float]:
    """
    Queries DuckDuckGo search to extract approximate calories from snippet text using POST.
    """
    import urllib.request
    import urllib.parse
    import re
    import html
    
    query = f"{food_name} calories"
    url = "https://html.duckduckgo.com/html/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    try:
        data = urllib.parse.urlencode({'q': query}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers)
        # Timeout quickly to avoid blocking the API call too long
        with urllib.request.urlopen(req, timeout=4.0) as res:
            body = res.read().decode('utf-8')
            # Extract snippets
            snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', body, re.DOTALL)
            combined_text = " ".join([html.unescape(re.sub(r'<[^>]*>', '', s)) for s in snippets])
            
            # Find numbers followed by calorie terms
            matches = re.findall(r'(\d+)\s*(?:calories|calorie|kcal|cal)', combined_text, re.IGNORECASE)
            for m in matches:
                val = int(m)
                if 20 <= val <= 1800:
                    return float(val)
    except Exception as e:
        logger.warning(f"Calorie search failed for '{food_name}': {str(e)}")
    return None

def parse_multiplier(name: str) -> Tuple[float, str]:
    """
    Parses quantity multipliers (numeric or textual) from the beginning of a food name.
    Returns (multiplier, cleaned_name).
    """
    import re
    name = name.strip()
    name_lower = name.lower()
    
    word_mappings = {
        "half a": 0.5,
        "half": 0.5,
        "quarter": 0.25,
        "one and a half": 1.5,
        "one and half": 1.5,
        "two and a half": 2.5,
        "two and half": 2.5,
        "one": 1.0,
        "two": 2.0,
        "three": 3.0,
        "four": 4.0,
        "five": 5.0,
        "six": 6.0,
        "seven": 7.0,
        "eight": 8.0,
        "nine": 9.0,
        "ten": 10.0
    }
    
    units_regex = r'(bowls|bowl|cups|cup|plates|plate|servings|serving|pieces|piece|pcs|whole|boiled|glasses|glass|tbsp|tsp|kg|grams|gram|g|ml)'
    
    # We check word mappings first
    for word, val in word_mappings.items():
        pattern = r'^' + re.escape(word) + r'\b\s*' + units_regex + r'?\s*(?:of)?\s*(.*)$'
        m = re.match(pattern, name_lower, re.IGNORECASE)
        if m:
            unit = m.group(1)
            rest = m.group(2)
            if unit:
                u = unit.lower()
                if u == 'kg':
                    val = val * 10.0
                elif u in ['g', 'gram', 'grams', 'ml']:
                    val = val / 100.0
            if rest and rest.strip():
                prefix_len = len(name) - len(rest.strip())
                cleaned_name = name[prefix_len:].strip()
                return val, cleaned_name
            elif unit and unit.strip():
                prefix_len = len(name) - len(unit.strip())
                cleaned_name = name[prefix_len:].strip()
                return val, cleaned_name

    # Next, handle numeric prefixes
    pattern = r'^(\d+(?:\.\d+)?)\s*' + units_regex + r'?\s*(?:of)?\s*(.*)$'
    m = re.match(pattern, name, re.IGNORECASE)
    if m:
        val = float(m.group(1))
        unit = m.group(2)
        rest = m.group(3)
        if unit:
            u = unit.lower()
            if u == 'kg':
                val = val * 10.0
            elif u in ['g', 'gram', 'grams', 'ml']:
                val = val / 100.0
        if rest and rest.strip():
            return val, rest.strip()
        elif unit and unit.strip():
            return val, unit.strip()
            
    return 1.0, name


async def generate_mock_agent_b(items: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Estimates macros for parsed items using live search extraction, keyword heuristics,
    and a comprehensive fallback dictionary.
    """
    total_cal = 0.0
    total_p = 0.0
    total_c = 0.0
    total_f = 0.0
    total_flg = 0.0
    
    if not isinstance(items, list):
        return {
            "calories": 0.0,
            "protein_g": 0.0,
            "carb_g": 0.0,
            "fiber_g": 0.0,
            "flagged_g": 0.0
        }

    # Food dictionary for exact/common matches (for a single/base serving/unit)
    food_db = {
        "sugarcane juice": {"cal": 74.0, "pro": 0.0, "carb": 20.17, "fib": 0.0, "flg": 15.0},
        "sugarcane": {"cal": 74.0, "pro": 0.0, "carb": 20.17, "fib": 0.0, "flg": 15.0},
        "broken wheat upma": {"cal": 180.0, "pro": 5.0, "carb": 32.0, "fib": 4.5, "flg": 0.0},
        "upma": {"cal": 180.0, "pro": 4.5, "carb": 32.0, "fib": 3.5, "flg": 0.0},
        "veg masala rice": {"cal": 220.0, "pro": 4.5, "carb": 42.0, "fib": 3.0, "flg": 5.0},
        "masala rice": {"cal": 220.0, "pro": 4.5, "carb": 42.0, "fib": 3.0, "flg": 5.0},
        "carrot": {"cal": 30.0, "pro": 0.7, "carb": 7.0, "fib": 2.0, "flg": 0.0},
        "cucumber": {"cal": 15.0, "pro": 0.6, "carb": 3.5, "fib": 0.8, "flg": 0.0},
        "idli": {"cal": 58.0, "pro": 1.8, "carb": 12.0, "fib": 0.8, "flg": 0.0},
        "idlis": {"cal": 58.0, "pro": 1.8, "carb": 12.0, "fib": 0.8, "flg": 0.0},
        "idly": {"cal": 58.0, "pro": 1.8, "carb": 12.0, "fib": 0.8, "flg": 0.0},
        "idlys": {"cal": 58.0, "pro": 1.8, "carb": 12.0, "fib": 0.8, "flg": 0.0},
        "idlily": {"cal": 58.0, "pro": 1.8, "carb": 12.0, "fib": 0.8, "flg": 0.0},
        "idlies": {"cal": 58.0, "pro": 1.8, "carb": 12.0, "fib": 0.8, "flg": 0.0},
        "coconut chutney": {"cal": 120.0, "pro": 1.5, "carb": 4.0, "fib": 1.5, "flg": 0.0},
        "chutney": {"cal": 100.0, "pro": 1.0, "carb": 5.0, "fib": 1.0, "flg": 0.0},
        "peanut butter": {"cal": 95.0, "pro": 3.5, "carb": 3.0, "fib": 1.0, "flg": 0.0},
        "beetroot fry": {"cal": 61.0, "pro": 1.63, "carb": 9.69, "fib": 2.8, "flg": 0.0},
        "beetroot": {"cal": 61.0, "pro": 1.63, "carb": 9.69, "fib": 2.8, "flg": 0.0},
        "lentils dal": {"cal": 165.0, "pro": 8.39, "carb": 18.73, "fib": 3.8, "flg": 0.0},
        "lentils": {"cal": 165.0, "pro": 8.39, "carb": 18.73, "fib": 3.8, "flg": 0.0},
        "dal": {"cal": 165.0, "pro": 8.39, "carb": 18.73, "fib": 3.8, "flg": 0.0},
        "white rice": {"cal": 204.0, "pro": 4.2, "carb": 44.08, "fib": 0.6, "flg": 0.0},
        "rice": {"cal": 204.0, "pro": 4.2, "carb": 44.08, "fib": 0.6, "flg": 0.0},
        "rice bowl": {"cal": 204.0, "pro": 4.2, "carb": 44.08, "fib": 0.6, "flg": 0.0},
        "potato": {"cal": 140.0, "pro": 2.5, "carb": 24.0, "fib": 2.5, "flg": 5.0},
        "potato curry": {"cal": 140.0, "pro": 2.5, "carb": 24.0, "fib": 2.5, "flg": 5.0},
        "channa": {"cal": 150.0, "pro": 8.0, "carb": 20.0, "fib": 5.0, "flg": 0.0},
        "chana": {"cal": 150.0, "pro": 8.0, "carb": 20.0, "fib": 5.0, "flg": 0.0},
        "biscuits": {"cal": 120.0, "pro": 2.0, "carb": 18.0, "fib": 0.5, "flg": 15.0},
        "biscuit": {"cal": 120.0, "pro": 2.0, "carb": 18.0, "fib": 0.5, "flg": 15.0},
        "puri with potato curry": {"cal": 420.0, "pro": 8.0, "carb": 55.0, "fib": 4.0, "flg": 30.0},
        "roasted peanuts": {"cal": 170.0, "pro": 7.0, "carb": 6.0, "fib": 2.5, "flg": 0.0},
        "rice with raw banana curry": {"cal": 380.0, "pro": 7.0, "carb": 72.0, "fib": 4.5, "flg": 10.0},
        "coconut water, boiled chana": {"cal": 190.0, "pro": 9.5, "carb": 26.0, "fib": 6.0, "flg": 0.0},
        "tamarind rice with veg manchuria": {"cal": 560.0, "pro": 11.0, "carb": 85.0, "fib": 5.0, "flg": 40.0},
        "coconut water": {"cal": 44.0, "pro": 0.5, "carb": 10.4, "fib": 0.0, "flg": 0.0},
        "boiled chana": {"cal": 150.0, "pro": 8.0, "carb": 20.0, "fib": 5.0, "flg": 0.0},
        "tamarind rice": {"cal": 350.0, "pro": 5.0, "carb": 65.0, "fib": 3.0, "flg": 15.0},
        "veg manchuria": {"cal": 220.0, "pro": 6.0, "carb": 22.0, "fib": 2.0, "flg": 25.0},
        "banana": {"cal": 105.0, "pro": 1.3, "carb": 27.0, "fib": 3.0, "flg": 0.0},
        "coconut milk": {"cal": 150.0, "pro": 1.5, "carb": 3.0, "fib": 0.0, "flg": 10.0},
        "salad": {"cal": 50.0, "pro": 1.5, "carb": 8.0, "fib": 4.0, "flg": 0.0},
        "oatmeal": {"cal": 150.0, "pro": 5.0, "carb": 27.0, "fib": 4.0, "flg": 0.0},
        "dosa with coconut chutney": {"cal": 280.0, "pro": 6.0, "carb": 40.0, "fib": 3.0, "flg": 20.0},
        "dosa": {"cal": 166.0, "pro": 4.8, "carb": 29.3, "fib": 1.0, "flg": 0.0},
        "chapati": {"cal": 114.0, "pro": 3.4, "carb": 18.5, "fib": 2.8, "flg": 0.0},
        "roti": {"cal": 114.0, "pro": 3.4, "carb": 18.5, "fib": 2.8, "flg": 0.0},
        "paneer curry": {"cal": 260.0, "pro": 15.0, "carb": 8.0, "fib": 1.0, "flg": 5.0},
        "paneer": {"cal": 260.0, "pro": 15.0, "carb": 8.0, "fib": 1.0, "flg": 5.0},
        "rice bowl": {"cal": 200.0, "pro": 4.0, "carb": 45.0, "fib": 1.0, "flg": 5.0},
        "rice": {"cal": 200.0, "pro": 4.0, "carb": 45.0, "fib": 1.0, "flg": 5.0},
        "chicken breast": {"cal": 165.0, "pro": 31.0, "carb": 0.0, "fib": 0.0, "flg": 0.0},
        "grilled chicken": {"cal": 165.0, "pro": 31.0, "carb": 0.0, "fib": 0.0, "flg": 0.0},
        "chicken biryani": {"cal": 600.0, "pro": 20.0, "carb": 80.0, "fib": 2.0, "flg": 150.0},
        "eggs": {"cal": 70.0, "pro": 6.0, "carb": 0.5, "fib": 0.0, "flg": 0.0},
        "boiled eggs": {"cal": 70.0, "pro": 6.0, "carb": 0.5, "fib": 0.0, "flg": 0.0},
        "egg": {"cal": 70.0, "pro": 6.0, "carb": 0.5, "fib": 0.0, "flg": 0.0}
    }
        
    for item in items:
        if not isinstance(item, dict):
            continue
            
        notes = str(item.get("notes", "")).lower()
        if "not consumed" in notes or "excluded" in notes or "leftover" in notes:
            continue
            
        name_orig = str(item.get("item", "")).strip()
        mult, cleaned_name = parse_multiplier(name_orig)
        name = cleaned_name.lower().strip()
        is_clean = item.get("type", "clean") == "clean"
        
        # 1. Try exact match in food_db
        matched = False
        for key, macros in food_db.items():
            if key == name or key in name:
                total_cal += macros["cal"] * mult
                total_p += macros["pro"] * mult
                total_c += macros["carb"] * mult
                total_f += macros["fib"] * mult
                total_flg += macros["flg"] * mult
                matched = True
                break
                
        if matched:
            continue
            
        # 1.5 Try FatSecret API search
        fatsecret_res = await search_fatsecret_nutrition(name)
        if fatsecret_res is not None:
            total_cal += fatsecret_res["cal"] * mult
            total_p += fatsecret_res["pro"] * mult
            total_c += fatsecret_res["carb"] * mult
            total_f += fatsecret_res["fib"] * mult
            total_flg += fatsecret_res["flg"] * mult
            continue

        # 2. Try DuckDuckGo search extraction
        cals_from_search = scrape_calories_from_search(name)
        if cals_from_search is not None:
            total_cal += cals_from_search * mult
            # Estimate macros relative to calorie size
            total_p += round(cals_from_search * (0.15 if is_clean else 0.04), 1) * mult
            total_c += round(cals_from_search * (0.10 if is_clean else 0.15), 1) * mult
            total_f += round(cals_from_search * (0.02 if is_clean else 0.005), 1) * mult
            if not is_clean:
                total_flg += round(cals_from_search * 0.10, 1) * mult
            continue
            
        # 3. Heuristic Keyword Matching
        cal = 150.0
        pro = 6.0
        carb = 15.0
        fib = 2.0
        flg = 0.0
        
        if "coconut water" in name or "water" in name or "salad" in name or "cucumber" in name:
            cal = 50.0
            pro = 1.0
            carb = 8.0
            fib = 3.0
            flg = 0.0
        elif "peanut" in name or "nuts" in name or "chana" in name or "egg" in name or "milk" in name or "chicken" in name:
            cal = 160.0
            pro = 12.0
            carb = 8.0
            fib = 3.0
            flg = 0.0
        elif "puri" in name or "manchuria" in name or "biryani" in name or "fried" in name or "sweet" in name or "sugar" in name:
            cal = 450.0
            pro = 8.0
            carb = 65.0
            fib = 2.0
            flg = 40.0
        elif "rice" in name or "dosa" in name or "roti" in name or "curry" in name or "oats" in name or "oatmeal" in name or "upma" in name:
            cal = 320.0
            pro = 8.0
            carb = 55.0
            fib = 4.0
            flg = 10.0
        else:
            # General fallback
            if is_clean:
                cal = 180.0
                pro = 10.0
                carb = 18.0
                fib = 3.0
                flg = 0.0
            else:
                cal = 260.0
                pro = 4.0
                carb = 35.0
                fib = 1.0
                flg = 30.0
                
        total_cal += cal * mult
        total_p += pro * mult
        total_c += carb * mult
        total_f += fib * mult
        total_flg += flg * mult
                
    return {
        "calories": round(total_cal, 2),
        "protein_g": round(total_p, 2),
        "carb_g": round(total_c, 2),
        "fiber_g": round(total_f, 2),
        "flagged_g": round(total_flg, 2)
    }

async def run_agent_a(text_input: str, image_bytes: bytes = None) -> List[Dict[str, Any]]:
    """
    Deploys Agent A (Vision & NLP Parser) to parse inputs and identify food items consumed,
    categorizing them into clean vs. flagged.
    """
    prompt = """
    You are Agent A (The Vision & NLP Parser). Your job is to dissect user meal descriptions (text) and photos of meal plates (images) to identify exactly what food items were consumed.
    
    Follow these instructions carefully:
    1. Parse the user's text description and/or image.
    2. Identify concrete food items.
    3. Note exclusions. For example, if the text says "had chicken biryani but only ate the chicken", identify that "chicken" was consumed and "rice (biryani)" was NOT consumed.
    4. For each item, classify it as "clean" or "flagged".
       - "clean": Targeted, high-value clean foods (proteins/fibers) like chicken breast, eggs, fish, vegetables, oats, quinoa, tofu, greek yogurt.
       - "flagged": Flagged ingredients/dishes containing refined sugars, maida (refined wheat flour), deep-fried foods, high trans fats, or sugary sodas.
    5. Output the result strictly in JSON list format matching this structure:
       [
         {"item": "Food Item Name", "type": "clean" | "flagged", "notes": "Brief explanation of what was eaten/excluded"}
       ]
    """
    
    gemini_resp = await call_gemini_api(prompt, user_text=text_input, image_bytes=image_bytes)
    
    if gemini_resp:
        try:
            # Clean possible markdown wrapping
            cleaned = gemini_resp.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = json.loads(cleaned.strip())
            
            # Structurally validate and sanitize parsed output
            if isinstance(parsed, list):
                valid_items = []
                for item in parsed:
                    if isinstance(item, dict):
                        valid_items.append({
                            "item": str(item.get("item", item.get("food", item.get("name", "Unknown food")))),
                            "type": str(item.get("type", "clean")),
                            "notes": str(item.get("notes", ""))
                        })
                if valid_items:
                    return valid_items
            elif isinstance(parsed, dict):
                # Maybe they wrapped it inside a key e.g. {"items": [...]}
                for key in ["items", "food", "foods", "meals"]:
                    if key in parsed and isinstance(parsed[key], list):
                        valid_items = []
                        for item in parsed[key]:
                            if isinstance(item, dict):
                                valid_items.append({
                                    "item": str(item.get("item", item.get("food", item.get("name", "Unknown food")))),
                                    "type": str(item.get("type", "clean")),
                                    "notes": str(item.get("notes", ""))
                                })
                        if valid_items:
                            return valid_items
        except Exception as e:
            logger.error(f"Error parsing Gemini Agent A JSON: {str(e)}. Response was: {gemini_resp}")
            
    # Fallback to mock
    return generate_mock_agent_a(text_input, image_bytes is not None)

async def run_agent_b(parsed_items: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Deploys Agent B (The Macro Calculator) to compute total calories, protein, carb, and fiber
    based on the concrete food items deduced.
    """
    prompt = """
    You are Agent B (The Macro Calculator). Your job is to estimate total nutritional values based on a list of food items.
    
    Input items will be in this JSON format:
    [
      {"item": "chicken breast", "type": "clean", "notes": "consumed"},
      {"item": "rice portion (from Biryani)", "type": "flagged", "notes": "not consumed/leftover"}
    ]
    
    Follow these instructions:
    1. Calculate total calories (kcal), protein (g), carbohydrates (g), fiber (g), and flagged ingredients (g) for the items.
    2. Crucially, if the item's notes indicate it was NOT consumed, excluded, or left over, its macros must be calculated as 0.
    3. Estimate "flagged_g" which is the weight of unhealthy/refined/sugar ingredients in grams (e.g. 50g for refined carbs, 30g for sugar in a soda).
    4. Output the result strictly in this JSON format:
       {
         "calories": float,
         "protein_g": float,
         "carb_g": float,
         "fiber_g": float,
         "flagged_g": float
       }
     """
    
    items_json = json.dumps(parsed_items)
    gemini_resp = await call_gemini_api(prompt, user_text=items_json)
    
    if gemini_resp:
        try:
            cleaned = gemini_resp.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = json.loads(cleaned.strip())
            
            if isinstance(parsed, dict):
                # Ensure all required keys exist, map synonyms, and cast to floats safely
                return {
                    "calories": float(parsed.get("calories", parsed.get("calories_kcal", parsed.get("cals", parsed.get("kcal", 0.0))))),
                    "protein_g": float(parsed.get("protein_g", parsed.get("protein", 0.0))),
                    "carb_g": float(parsed.get("carb_g", parsed.get("carbs", parsed.get("carbohydrates", 0.0)))),
                    "fiber_g": float(parsed.get("fiber_g", parsed.get("fiber", 0.0))),
                    "flagged_g": float(parsed.get("flagged_g", parsed.get("flagged", 0.0)))
                }
        except Exception as e:
            logger.error(f"Error parsing Gemini Agent B JSON: {str(e)}. Response was: {gemini_resp}")
            
    # Fallback to mock
    return await generate_mock_agent_b(parsed_items)

async def process_food_log(text_input: str, image_bytes: bytes = None) -> Tuple[List[Dict[str, Any]], Dict[str, float]]:
    """
    Executes Agent A and Agent B in a sequential pipeline.
    First parses items with Agent A, then calculates macros with Agent B.
    """
    # 1. Run Agent A
    deduced_items = await run_agent_a(text_input, image_bytes)
    
    # 2. Run Agent B
    macros = await run_agent_b(deduced_items)
    
    return deduced_items, macros
