"""
City Disruption Analyzer for Float
===================================
Monitors a city for environmental and social disruptions by:
1. Generating an H3 hex grid over the city
2. Fetching weather + AQI data from OpenWeather
3. Scraping recent news via DuckDuckGo
4. Classifying news with an LLM via OpenRouter
5. Producing an `active_disruptions` dict for the automated dispatcher

Environment variables required:
    OPENWEATHER_API_KEY  — from openweathermap.org
    OPENROUTER_API_KEY   — from openrouter.ai
"""

import os
import json
import time
import logging
from datetime import datetime, timedelta, timezone

import h3
import requests
from duckduckgo_search import DDGS

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

H3_RESOLUTION = 9  # ~0.1 sq km per cell — matches index_converter.py
GRID_K_RING = 15   # k-ring radius: covers ~4-5 km from center at res 9

WEATHER_BATCH_RESOLUTION = 7  # coarser res for batching weather API calls

OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5"
OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "google/gemini-3.1-flash-lite-preview"

NEWS_MAX_AGE_HOURS = 24
NEWS_TOP_N = 5

# Disruption severity thresholds and payout multipliers
DISRUPTION_THRESHOLDS = {
    "SEVERE_WATERLOGGING": {"payout_multiplier": 1.5},
    "HEAVY_RAIN":          {"payout_multiplier": 1.4},
    "EXTREME_HEAT":        {"payout_multiplier": 1.3},
    "SEVERE_HEAT":         {"payout_multiplier": 1.15},
    "HAZARDOUS_AQI":       {"payout_multiplier": 1.2},
    "POOR_AQI":            {"payout_multiplier": 1.1},
    "LANDSLIDE_RISK":      {"payout_multiplier": 1.6},
    "ROAD_CLOSURE":        {"payout_multiplier": 1.3},
    "PROTEST":             {"payout_multiplier": 1.4},
    "SUDDEN_CURFEW":       {"payout_multiplier": 2.0},
    "CONNECTIVITY_OUTAGE": {"payout_multiplier": 1.2},
}

NEWS_SEARCH_QUERIES = [
    "{city} road closure",
    "{city} protest",
    "{city} curfew",
    "{city} internet outage",
    "{city} flood waterlogging",
    "{city} landslide",
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# 1. City Grid Generator
# ──────────────────────────────────────────────

def generate_city_grid(lat: float, lng: float, k_ring: int = GRID_K_RING) -> list[str]:
    """Generate H3 hex IDs covering a city area using a k-ring around the center."""
    center_hex = h3.latlng_to_cell(lat, lng, H3_RESOLUTION)
    hexes = h3.grid_disk(center_hex, k_ring)
    log.info(f"Generated grid of {len(hexes)} hexes (k={k_ring}) around ({lat}, {lng})")
    return list(hexes)


# ──────────────────────────────────────────────
# 2. Weather & AQI Fetcher
# ──────────────────────────────────────────────

def _get_api_key(name: str) -> str:
    key = os.environ.get(name)
    if not key:
        raise EnvironmentError(f"Missing environment variable: {name}")
    return key


def _batch_hexes_by_parent(hexes: list[str], parent_res: int = WEATHER_BATCH_RESOLUTION) -> dict[str, list[str]]:
    """Group fine-resolution hexes by their coarser parent to reduce API calls."""
    batches: dict[str, list[str]] = {}
    for h in hexes:
        parent = h3.cell_to_parent(h, parent_res)
        batches.setdefault(parent, []).append(h)
    return batches


def fetch_weather(lat: float, lng: float, api_key: str) -> dict:
    """Fetch current weather from OpenWeather."""
    resp = requests.get(
        f"{OPENWEATHER_BASE}/weather",
        params={"lat": lat, "lon": lng, "appid": api_key, "units": "metric"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_aqi(lat: float, lng: float, api_key: str) -> int:
    """Fetch current AQI index (1-5 scale) and PM2.5 from OpenWeather Air Pollution."""
    resp = requests.get(
        f"{OPENWEATHER_BASE}/air_pollution",
        params={"lat": lat, "lon": lng, "appid": api_key},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    # OpenWeather AQI is 1-5; we also grab PM2.5 for finer classification
    aqi_index = data["list"][0]["main"]["aqi"]
    pm25 = data["list"][0]["components"].get("pm2_5", 0)
    return aqi_index, pm25


def fetch_weather_for_grid(hexes: list[str]) -> dict[str, dict]:
    """
    Fetch weather + AQI for all hexes, batching by coarser parent hex.
    Returns {hex_id: {"temp": float, "rain_mm": float, "aqi": int, "pm25": float, "weather_main": str}}
    """
    api_key = _get_api_key("OPENWEATHER_API_KEY")
    batches = _batch_hexes_by_parent(hexes)
    log.info(f"Fetching weather for {len(batches)} unique parent regions (from {len(hexes)} hexes)")

    results: dict[str, dict] = {}

    for parent_hex, child_hexes in batches.items():
        lat, lng = h3.cell_to_latlng(parent_hex)

        try:
            weather = fetch_weather(lat, lng, api_key)
            aqi_index, pm25 = fetch_aqi(lat, lng, api_key)
        except requests.RequestException as e:
            log.warning(f"Weather API error for parent {parent_hex}: {e}")
            continue

        temp = weather.get("main", {}).get("temp", 0)
        rain_1h = weather.get("rain", {}).get("1h", 0)
        weather_main = weather.get("weather", [{}])[0].get("main", "")

        info = {
            "temp": temp,
            "rain_mm": rain_1h,
            "aqi_index": aqi_index,  # 1-5 scale
            "pm25": pm25,
            "weather_main": weather_main,
        }

        for child in child_hexes:
            results[child] = info

        # Small delay to respect rate limits
        time.sleep(0.25)

    log.info(f"Weather data collected for {len(results)}/{len(hexes)} hexes")
    return results


# ──────────────────────────────────────────────
# 3. News Scraper (DuckDuckGo)
# ──────────────────────────────────────────────

def scrape_news(city_name: str) -> list[dict]:
    """
    Search DuckDuckGo news for disruption-related articles.
    Returns list of {title, body, url, date, query_category}.
    Only articles from the last NEWS_MAX_AGE_HOURS are kept.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=NEWS_MAX_AGE_HOURS)
    articles = []

    with DDGS() as ddgs:
        for query_template in NEWS_SEARCH_QUERIES:
            query = query_template.format(city=city_name)
            try:
                results = ddgs.news(query, max_results=NEWS_TOP_N)
            except Exception as e:
                log.warning(f"News search failed for '{query}': {e}")
                continue

            for r in results:
                # Parse the article date
                article_date = _parse_news_date(r.get("date", ""))
                if article_date and article_date < cutoff:
                    log.debug(f"Skipping old article: {r.get('title', '')[:60]}...")
                    continue

                articles.append({
                    "title": r.get("title", ""),
                    "body": r.get("body", ""),
                    "url": r.get("url", ""),
                    "date": r.get("date", ""),
                    "source": r.get("source", ""),
                    "query": query,
                })

            time.sleep(0.5)  # Be polite to DDG

    # Deduplicate by URL
    seen_urls = set()
    unique = []
    for a in articles:
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            unique.append(a)

    log.info(f"Scraped {len(unique)} unique recent news articles for '{city_name}'")
    return unique


def _parse_news_date(date_str: str) -> datetime | None:
    """Try to parse a news article date string into a timezone-aware datetime."""
    if not date_str:
        return None

    formats = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%a, %d %b %Y %H:%M:%S %z",
        "%Y-%m-%d %H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue

    log.debug(f"Could not parse date: '{date_str}'")
    return None


# ──────────────────────────────────────────────
# 4. News Classifier (OpenRouter LLM)
# ──────────────────────────────────────────────

CLASSIFICATION_PROMPT = """You are a strict news-relevance filter for a ride-hailing platform in {city}.

CURRENT DATE AND TIME: {current_datetime}

Your job is to determine if each news article describes an ONGOING or IMMINENT disruption
that would physically affect road travel or driver safety RIGHT NOW.

RULES — READ CAREFULLY:
1. An article about a PAST event that has been RESOLVED is NOT a disruption. Classify as NONE.
2. An article about a FUTURE/PLANNED event is NOT a current disruption unless it is happening within the next 2 hours. Classify as NONE.
3. An article that merely MENTIONS a keyword (e.g. "protest") in passing or in historical context is NONE.
4. Only classify as a disruption if the article describes something ACTIVELY happening or about to happen.
5. If the article date is more than 24 hours old, classify as NONE regardless of content.
6. When in doubt, classify as NONE. False negatives are better than false positives.

DISRUPTION CATEGORIES:
- SEVERE_WATERLOGGING: Active flooding or waterlogged roads making them impassable NOW
- HEAVY_RAIN: Ongoing heavy rainfall causing driving hazards NOW
- LANDSLIDE_RISK: Active landslide or imminent landslide warning in effect NOW
- ROAD_CLOSURE: Roads currently shut or blocked (by authorities, accidents, or debris)
- PROTEST: Active protest/rally/demonstration currently blocking roads
- SUDDEN_CURFEW: Curfew or Section 144 currently in effect or announced for the next few hours
- CONNECTIVITY_OUTAGE: Internet or cell tower outage currently affecting the area
- NONE: Not a relevant CURRENT disruption (this should be the most common classification)

For each article respond with a JSON array. Each element:
- "article_index": 0-based index
- "disruption_type": one of the categories above (use NONE liberally)
- "severity": "LOW", "MEDIUM", or "HIGH" (only if NOT none)
- "affected_area": specific locality/neighbourhood in {city} if mentioned, or "CITY_WIDE"
- "confidence": float 0.0-1.0 (how certain you are this is an active disruption)
- "reasoning": one sentence explaining your classification

Return ONLY the JSON array.

ARTICLES:
{articles_text}
"""


def _call_openrouter(prompt: str, api_key: str, temperature: float = 0.1, timeout: int = 30) -> str | None:
    """Make a single OpenRouter LLM call. Returns content string or None on failure."""
    try:
        resp = requests.post(
            OPENROUTER_BASE,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1])

        return content
    except (requests.RequestException, KeyError, IndexError) as e:
        log.error(f"OpenRouter call failed: {e}")
        return None


def _parse_llm_json(content: str | None) -> list | dict | None:
    """Safely parse LLM JSON output."""
    if content is None:
        return None
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        log.error(f"Failed to parse LLM JSON: {e}\nContent: {content[:200]}")
        return None


def classify_news(articles: list[dict], city_name: str) -> list[dict]:
    """
    Use OpenRouter LLM to classify news articles into disruption categories.
    Includes current datetime for temporal awareness.
    Returns list of {article_index, disruption_type, severity, affected_area, confidence, reasoning}.
    """
    if not articles:
        return []

    api_key = _get_api_key("OPENROUTER_API_KEY")
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Build article text with clear metadata
    articles_text = ""
    for i, a in enumerate(articles):
        articles_text += (
            f"\n[{i}] Title: {a['title']}"
            f"\n    Date published: {a['date']}"
            f"\n    Source: {a['source']}"
            f"\n    Snippet: {a['body'][:300]}"
            f"\n    (Found via search: '{a['query']}')"
            f"\n"
        )

    prompt = CLASSIFICATION_PROMPT.format(
        city=city_name,
        current_datetime=now_str,
        articles_text=articles_text,
    )

    content = _call_openrouter(prompt, api_key)
    classifications = _parse_llm_json(content)

    if classifications is None:
        return []

    # Filter: drop NONE classifications and low-confidence results early
    valid = [
        c for c in classifications
        if c.get("disruption_type", "NONE") != "NONE"
        and c.get("confidence", 0) >= 0.5
    ]

    log.info(
        f"LLM classified {len(valid)} active disruptions "
        f"(filtered from {len(classifications)} total, {len(articles)} articles)"
    )
    for v in valid:
        log.info(f"  [{v.get('disruption_type')}] {v.get('affected_area')} "
                 f"(confidence={v.get('confidence')}) — {v.get('reasoning', '')}")

    return valid


# ──────────────────────────────────────────────
# 5. Per-Grid LLM Assessment
# ──────────────────────────────────────────────

GRID_ASSESSMENT_PROMPT = """You are a hyperlocal disruption assessor for a ride-hailing platform.

CURRENT DATE AND TIME: {current_datetime}
CITY: {city}
GRID REGION: centered at ({lat}, {lng})

Below is the REAL-TIME DATA for this grid region. Assess whether there are any
active disruptions that would affect ride-hailing operations.

WEATHER DATA:
- Temperature: {temp}°C
- Rainfall (last 1h): {rain_mm} mm
- Conditions: {weather_main}
- AQI Index: {aqi_index}/5 (1=Good, 5=Very Poor)
- PM2.5: {pm25} µg/m³

RECENT NEWS DISRUPTIONS DETECTED IN THIS CITY:
{news_summary}

Based on ALL the data above, determine what disruptions (if any) are active in this grid region.

RULES:
1. Weather data is GROUND TRUTH — if temperature is 44°C, that IS extreme heat.
2. AQI 4+ with PM2.5 > 150 IS poor air quality. AQI 5 or PM2.5 > 250 IS hazardous.
3. Rain > 50mm/h IS heavy rain. Rain > 100mm/h means potential waterlogging.
4. News disruptions only apply if the affected area matches or is near this grid region.
5. If a news disruption says "CITY_WIDE", it applies to this grid.
6. If no disruptions are warranted, return an empty array [].

Return a JSON array of disruptions. Each element:
- "type": one of SEVERE_WATERLOGGING, HEAVY_RAIN, EXTREME_HEAT, SEVERE_HEAT, HAZARDOUS_AQI, POOR_AQI, LANDSLIDE_RISK, ROAD_CLOSURE, PROTEST, SUDDEN_CURFEW, CONNECTIVITY_OUTAGE
- "payout_multiplier": a float (use these base values: SEVERE_WATERLOGGING=1.5, HEAVY_RAIN=1.4, EXTREME_HEAT=1.3, SEVERE_HEAT=1.15, HAZARDOUS_AQI=1.2, POOR_AQI=1.1, LANDSLIDE_RISK=1.6, ROAD_CLOSURE=1.3, PROTEST=1.4, SUDDEN_CURFEW=2.0, CONNECTIVITY_OUTAGE=1.2). You may adjust ±20% based on severity.
- "source": the URL of the news article that supports this disruption, or "OpenWeather API" if based on weather/AQI data
- "reasoning": one sentence justification

Return ONLY the JSON array. Empty array [] if no disruptions.
"""


def _build_news_summary(classifications: list[dict], articles: list[dict]) -> str:
    """Build a concise news summary string for the grid assessment prompt."""
    if not classifications:
        return "No recent disruptions detected in news."

    lines = []
    for c in classifications:
        idx = c.get("article_index", -1)
        title = articles[idx]["title"] if 0 <= idx < len(articles) else "Unknown"
        url = articles[idx]["url"] if 0 <= idx < len(articles) else ""
        lines.append(
            f"- [{c['disruption_type']}] {c.get('affected_area', '?')}: "
            f"{title} (confidence={c.get('confidence', '?')}, severity={c.get('severity', '?')}) "
            f"Source: {url}"
        )
    return "\n".join(lines)


def assess_grid_regions(
    hexes: list[str],
    weather_data: dict[str, dict],
    news_classifications: list[dict],
    articles: list[dict],
    city_name: str,
) -> dict[str, dict]:
    """
    Per-grid-region LLM assessment.
    Groups hexes by parent (res 7), sends one LLM call per parent region
    with that region's weather data + city news context.
    Returns active_disruptions dict.
    """
    api_key = _get_api_key("OPENROUTER_API_KEY")
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    news_summary = _build_news_summary(news_classifications, articles)

    batches = _batch_hexes_by_parent(hexes)
    active_disruptions: dict[str, dict] = {}

    log.info(f"Running per-grid LLM assessment for {len(batches)} regions...")

    for i, (parent_hex, child_hexes) in enumerate(batches.items()):
        # Get weather data for this region (use first child's data)
        sample_hex = child_hexes[0]
        w = weather_data.get(sample_hex, {})

        if not w:
            log.debug(f"No weather data for region {parent_hex}, skipping LLM assessment")
            continue

        lat, lng = h3.cell_to_latlng(parent_hex)

        prompt = GRID_ASSESSMENT_PROMPT.format(
            current_datetime=now_str,
            city=city_name,
            lat=round(lat, 4),
            lng=round(lng, 4),
            temp=w.get("temp", "N/A"),
            rain_mm=w.get("rain_mm", 0),
            weather_main=w.get("weather_main", "N/A"),
            aqi_index=w.get("aqi_index", "N/A"),
            pm25=w.get("pm25", "N/A"),
            news_summary=news_summary,
        )

        content = _call_openrouter(prompt, api_key, temperature=0.05, timeout=20)
        region_disruptions = _parse_llm_json(content)

        if region_disruptions and isinstance(region_disruptions, list):
            # Pick the worst disruption for this region
            valid = [
                d for d in region_disruptions
                if d.get("type") in DISRUPTION_THRESHOLDS
            ]
            if valid:
                worst = max(valid, key=lambda d: d.get("payout_multiplier", 1.0))
                disruption_entry = {
                    "type": worst["type"],
                    "payout_multiplier": round(
                        min(max(worst.get("payout_multiplier", 1.0), 1.0), 3.0), 2
                    ),
                    "source": worst.get("source", "OpenWeather API"),
                }
                log.info(
                    f"  Region {i+1}/{len(batches)} ({round(lat,3)},{round(lng,3)}): "
                    f"{disruption_entry['type']} x{disruption_entry['payout_multiplier']} "
                    f"— {worst.get('reasoning', '')}"
                )
                # Apply to all child hexes in this region
                for child_hex in child_hexes:
                    active_disruptions[child_hex] = disruption_entry
            else:
                log.debug(f"  Region {i+1}/{len(batches)}: no disruptions")
        else:
            log.debug(f"  Region {i+1}/{len(batches)}: no disruptions")

        # Rate limit between calls
        time.sleep(0.3)

    return active_disruptions


# ──────────────────────────────────────────────
# 6. Weather-Only Disruption Fallback
# ──────────────────────────────────────────────

def _weather_disruptions(weather_data: dict) -> list[dict]:
    """Derive disruptions from weather/AQI data for a single hex (used as fallback)."""
    disruptions = []
    temp = weather_data.get("temp", 0)
    rain = weather_data.get("rain_mm", 0)
    aqi = weather_data.get("aqi_index", 1)
    pm25 = weather_data.get("pm25", 0)

    if aqi >= 5 or pm25 > 250:
        disruptions.append({"type": "HAZARDOUS_AQI", "source": "OpenWeather API", **DISRUPTION_THRESHOLDS["HAZARDOUS_AQI"]})
    elif aqi >= 4 or pm25 > 150:
        disruptions.append({"type": "POOR_AQI", "source": "OpenWeather API", **DISRUPTION_THRESHOLDS["POOR_AQI"]})

    if temp > 42:
        disruptions.append({"type": "EXTREME_HEAT", "source": "OpenWeather API", **DISRUPTION_THRESHOLDS["EXTREME_HEAT"]})
    elif temp > 38:
        disruptions.append({"type": "SEVERE_HEAT", "source": "OpenWeather API", **DISRUPTION_THRESHOLDS["SEVERE_HEAT"]})

    if rain > 100:
        disruptions.append({"type": "SEVERE_WATERLOGGING", "source": "OpenWeather API", **DISRUPTION_THRESHOLDS["SEVERE_WATERLOGGING"]})
    elif rain > 50:
        disruptions.append({"type": "HEAVY_RAIN", "source": "OpenWeather API", **DISRUPTION_THRESHOLDS["HEAVY_RAIN"]})

    return disruptions


def build_active_disruptions_fallback(
    city_hexes: list[str],
    weather_data: dict[str, dict],
) -> dict[str, dict]:
    """
    Fallback: build disruptions from weather data only (if LLM calls fail).
    """
    active_disruptions: dict[str, dict] = {}
    for hex_id in city_hexes:
        if hex_id in weather_data:
            disrs = _weather_disruptions(weather_data[hex_id])
            if disrs:
                worst = max(disrs, key=lambda d: d["payout_multiplier"])
                active_disruptions[hex_id] = {
                    "type": worst["type"],
                    "payout_multiplier": worst["payout_multiplier"],
                    "source": worst.get("source", "OpenWeather API"),
                }
    return active_disruptions


# ──────────────────────────────────────────────
# 7. Main Entry Point
# ──────────────────────────────────────────────

def get_active_disruptions(
    city_name: str = "Shillong",
    lat: float = 25.57,
    lng: float = 91.88,
    k_ring: int = GRID_K_RING,
) -> dict[str, dict]:
    """
    End-to-end: analyze a city for disruptions and return the active_disruptions dict
    that plugs into the automated dispatcher.

    Pipeline:
      1. Generate H3 hex grid
      2. Fetch weather + AQI per region
      3. Scrape recent news from DuckDuckGo
      4. LLM pass 1: Classify news articles (temporally aware, strict filtering)
      5. LLM pass 2: Per-grid-region assessment combining weather + news
      6. Merge results → active_disruptions

    Returns:
        {hex_id: {"type": str, "payout_multiplier": float}, ...}
    """
    log.info(f"=== Disruption Analysis for {city_name} ({lat}, {lng}) ===")
    log.info(f"Current time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")

    # Step 1: Generate city grid
    city_hexes = generate_city_grid(lat, lng, k_ring)

    # Step 2: Fetch weather & AQI
    log.info("Fetching weather and AQI data...")
    weather_data = fetch_weather_for_grid(city_hexes)

    # Step 3: Scrape news
    log.info("Scraping recent news...")
    articles = scrape_news(city_name)

    # Step 4: Classify news (LLM pass 1 — strict temporal filter)
    log.info("LLM Pass 1: Classifying news articles...")
    news_classifications = classify_news(articles, city_name)

    # Step 5: Per-grid assessment (LLM pass 2 — combines weather + news per region)
    log.info("LLM Pass 2: Per-grid region assessment...")
    try:
        active_disruptions = assess_grid_regions(
            city_hexes, weather_data, news_classifications, articles, city_name
        )
    except Exception as e:
        log.error(f"Per-grid LLM assessment failed, falling back to weather-only: {e}")
        active_disruptions = build_active_disruptions_fallback(city_hexes, weather_data)

    log.info(f"Found {len(active_disruptions)} hexes with active disruptions")

    # Print summary
    type_counts: dict[str, int] = {}
    for d in active_disruptions.values():
        t = d["type"]
        type_counts[t] = type_counts.get(t, 0) + 1
    for dtype, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        log.info(f"  {dtype}: {count} hexes")

    return active_disruptions


if __name__ == "__main__":
    disruptions = get_active_disruptions()
    print("\n=== Active Disruptions ===")
    print(json.dumps(disruptions, indent=2))
    print(f"\nTotal affected hexes: {len(disruptions)}")
