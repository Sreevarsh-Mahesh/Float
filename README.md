[Insert Banner Image: A minimalist, modern graphic of a folded paper boat floating on calm blue water with the word "Float" in clean typography]

# Float: Income Protection for the Gig Economy

[Insert Video Placeholder: Link to 2-minute pitch and strategy video]

## 1. Problem we are solving and niche we are focusing on

[cite_start]India's platform-based delivery partners are the backbone of our fast-paced digital economy[cite: 9]. [cite_start]However, external disruptions such as extreme weather, pollution, and natural disasters can reduce their working hours and cause them to lose 20-30% of their monthly earnings[cite: 10]. [cite_start]Currently, gig workers have no income protection against these uncontrollable events[cite: 11]. [cite_start]When disruptions occur, they bear the full financial loss with no safety net[cite: 12].

[cite_start]Our primary niche focuses strictly on food delivery partners operating on platforms like Zomato and Swiggy[cite: 82]. 

[cite_start]**Crucial Scope Definition:** Float is a parametric insurance platform designed exclusively for loss of income[cite: 83]. [cite_start]We strictly exclude coverage for health, life, accidents, or vehicle repairs[cite: 17]. If a flood damages a bike, we do not pay for the repairs; we pay for the wages lost because the partner could not work.

## 2. How we are solving the problem

[cite_start]We are building Float, an AI-enabled parametric insurance platform that safeguards gig workers against income loss caused by external disruptions[cite: 14]. 

A mobile app will be the primary platform for Float. We chose a native mobile approach for three specific reasons:
* Delivery partners already rely entirely on their mobile devices for their daily operations.
* The system requires persistent notifications natively supported by mobile OS environments.
* We must capture logs locally even when network connectivity drops, ensuring that power outages or internet blackouts are still recorded and covered.

[cite_start]Float offers automated coverage and payouts based on a weekly pricing model, perfectly aligned with the typical earnings cycle of gig workers[cite: 15]. Partners can select from three coverage tiers based on their weekly budget:
* Basic: 50% Coverage
* Protection: 75% Coverage
* Advanced Protection: 100% Coverage

[cite_start]Whenever a driver experiences an issue leading to income loss, the system uses real-time trigger monitoring to automatically recognize the environmental or external factor[cite: 46]. [cite_start]It then instantly processes a payout directly to their account[cite: 49]. 

**Covered Factors:**
* **Environmental:** AQI spikes, rain, floods, landslides, and extreme heat.
* **Social and Infrastructure:** Road closures, protests, sudden curfews, and cell tower outages.
* **Platform and Market:** Delivery platform downtime or extreme oversupply delays (e.g., peak hour restaurant crowding causing unpaid delays).

## 3. User flow / experience


1. **Onboarding:** A delivery partner downloads Float, registers, and securely verifies their identity directly through their primary food delivery platform.
2. **Policy Selection:** They select a weekly plan that fits their budget and activate coverage immediately. 
3. **Zero-Touch Claims:** From that moment, if an automated trigger fires in their active zone, they get paid automatically. 
4. **Transparency:** A push notification informs them of the specific event, the credited amount, and the calculation basis. Their dashboard maintains a persistent, running record of every payout and the corresponding trigger event.

## 4. The Maths (Payouts, Premiums, etc)

### Premiums
[Placeholder for dynamic premium calculation logic using AI to adjust weekly pricing based on hyper-local risk factors]

### Payouts Model
Each factor has a specific trigger limit. Once the threshold is crossed, the payout logic is initiated.

**1. Base Metrics**
* Daily Average: Sum of Daily Earnings / Active Days
* Weekly Average: Sum of Daily Earnings / 7
* Monthly Average: Sum of Daily Earnings / 30
* Weekly Variance: Sum of (Daily Earning minus Daily Average) squared / 7
* Standard Deviation: Square root of Weekly Variance
* Anomaly Threshold: 3 * Standard Deviation

**2. Environmental Payouts**
* Rain Payout: Scaling Factor * (Current Rain / Average Rain) * Average Pay
* AQI Payout: (Current AQI / Max AQI) * Scaling Factor * Daily Average Pay
* Heat Payout: Heat Alert (Binary 1 or 0) * (Feels Like Temp / Max Temp) * Average Pay * Scaling Factor

**3. Acts of God Payout**
* Payout: Average Pay * Scaling Factor

**4. Road Anomalies & Market Delays**
* Event Validation: Grid has flagged event AND Event time equals Driver ping time
* Speed Spread: Historical Average Speed minus Current Order Speed
* Slow Delivery Trigger: Speed Spread > (3 * Speed Variance)
* Slow Delivery Count: Incremented by 1 for every triggered Slow Delivery
* Tier Check: Slow Delivery Count > Tier Threshold
* Grid Consensus: Do other drivers in the same H3 grid at the same time have speed anomalies?
* Final Payout Trigger: Tier Check passed AND Grid Consensus is Yes

## 5. Technical Implementation Plan

[Insert Diagram: System architecture flow showing the mobile app communicating with FastAPI, passing data to the Postgres database and Redis queues, with the PyTorch model handling trigger validation]

We utilize Uber's H3 grid pattern to define unit locations on the map as hexagon grids. This standardizes location data for easier validation and consensus checking.

**Tech Stack:**
* **Frontend:** React Native (Expo)
* **Backend:** FastAPI
* **AI/ML:** PyTorch, LangGraph
* **Mapping/Geospatial:** H3 Library
* **Queue/Workers:** Redis + Celery
* **Database:** PostgreSQL

**Data Sources:**
[Placeholder for specific APIs used for weather, traffic, and platform simulated data]

## 6. Adversarial Defense & Anti-Spoofing Strategy (Market Crash Counter Plan)

[cite_start]To prevent fraudulent claims, we implement intelligent fraud detection focusing on location and activity validation[cite: 39, 42]. GPS coordinates are sampled every 2 minutes and converted to an H3 cell at resolution 9 to 10. A sliding window of the last N pings forms the worker's trajectory. 

Validation checks run on every new ping:
* **Speed Check:** Calculated as H3 distance / time delta. A bike has a realistic max of 50 km/h. We flag speeds greater than 80 km/h between pings. On foot, we flag speeds greater than 15 km/h.
* **Hop Continuity Check:** Grid distance must be less than or equal to the expected hops for the transport mode. A teleport from one cell to a distant cell in 2 minutes is flagged, regardless of stated speed.
* **Trajectory Smoothness:** Sudden direction reversals or zigzag patterns inconsistent with known road networks are scored as anomalies.
* **Cell History Consistency:** If a worker claims a disruption in a specific cell, their trajectory must include that cell or its immediate surrounding ring. Claiming a flood disruption in an unvisited cell results in an automatic flag for review.

**Scoring Logic:**
Each ping produces a spoof score between 0 and 1.
* If rolling average spoof score > 0.6: Claim is auto-rejected and sent to a human moderator.
* If rolling average spoof score > 0.85: Account is flagged and security deposit is partially held.

**Implementation Sketch:**

```python
import h3

SAMPLE_INTERVAL_MIN = 2
MAX_BIKE_SPEED_KMH = 80

def to_cell(lat, lng, res=9):
    return h3.latlng_to_cell(lat, lng, res)

def cell_distance_km(a, b):
    la, lo = h3.cell_to_latlng(a)
    lb, ll = h3.cell_to_latlng(b)
    return haversine(la, lo, lb, ll)

def validate_hop(prev_cell, curr_cell, minutes_elapsed):
    dist_km = cell_distance_km(prev_cell, curr_cell)
    speed   = dist_km / (minutes_elapsed / 60)
    hops    = h3.grid_distance(prev_cell, curr_cell)
    spoof   = 0.0
    
    if speed > MAX_BIKE_SPEED_KMH: 
        spoof += 0.5
    if hops > 12:                   
        spoof += 0.4
        
    return min(spoof, 1.0)

def claim_location_check(trajectory_cells, claimed_cell):
    reachable = h3.grid_disk(claimed_cell, 1)
    return any(c in reachable for c in trajectory_cells)
```
