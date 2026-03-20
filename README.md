[Insert Banner Image: A minimalist, modern graphic of a folded paper boat floating on calm blue water with the word "Float" in clean typography]

# Float: Income Protection for the Gig Economy

[Insert Video Placeholder: Link to 2-minute pitch and strategy video]

## 1. Problem we are solving and niche we are focusing on

India's platform-based delivery partners are the backbone of our fast-paced digital economy. However, external disruptions such as extreme weather, pollution, and natural disasters can reduce their working hours and cause them to lose 20-30% of their monthly earnings. Currently, gig workers have no income protection against these uncontrollable events. When disruptions occur, they bear the full financial loss with no safety net.

Our primary niche focuses strictly on food delivery partners operating on platforms like Zomato and Swiggy. 

**Crucial Scope Definition:** Float is a parametric insurance platform designed exclusively for loss of income. We strictly exclude coverage for health, life, accidents, or vehicle repairs. If a flood damages a bike, we do not pay for the repairs; we pay for the wages lost because the partner could not work.

## 2. How we are solving the problem

We are building Float, an AI-enabled parametric insurance platform that safeguards gig workers against income loss caused by external disruptions. 

A mobile app will be the primary platform for Float. We chose a native mobile approach for three specific reasons:
* Delivery partners already rely entirely on their mobile devices for their daily operations.
* The system requires persistent notifications natively supported by mobile OS environments.
* We must capture logs locally even when network connectivity drops, ensuring that power outages or internet blackouts are still recorded and covered.

Float offers automated coverage and payouts based on a weekly pricing model, perfectly aligned with the typical earnings cycle of gig workers. Partners can select from three coverage tiers based on their weekly budget:
* Basic: 50% Coverage
* Protection: 75% Coverage
* Advanced Protection: 100% Coverage

Whenever a driver experiences an issue leading to income loss, the system uses real-time trigger monitoring to automatically recognize the environmental or external factor. It then instantly processes a payout directly to their account. 

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

### AI/ML Integration

Most insurance platforms treat location as just a city name. Float doesn't. We map the entire operating area into H3 hexagonal cells at resolution 9 (roughly 0.1 sq km per cell) and treat the city as a live graph where every cell communicates with its neighbors. This is the core idea behind everything Float does with AI.

#### The Model - ST-GNN

Float uses a Spatio-Temporal Graph Neural Network. Two components working together:

**GCN (Graph Convolutional Network) - the spatial part**

Every H3 cell has 6 neighbors via `h3.k_ring(cell_id, k=1)`. The GCN makes each cell look at its neighbors and update its own risk understanding based on what they are seeing. So if the cells surrounding a worker's zone are flooding, that worker's risk score goes up even before their own cell crosses the rainfall threshold. Two GCN layers means the model sees up to 2 hops away, roughly a 300-400m radius of spatial context per cell.

**Transformer - the temporal part**

Standard models only look at the previous timestep. The Transformer uses self-attention to figure out which past moments actually matter, like last Monday at 7 PM or last monsoon season, and weighs them accordingly. Much more powerful than an LSTM for seasonal and weekly patterns.

Combined, the model learns things like: "whenever this spatial activation pattern appears in the northwest cluster, the central delivery zone floods 6 hours later." No simpler model can learn that.


#### Input Features

Every H3 cell at every timestep carries the following feature vector:

| Feature | Source |
|---|---|
| Rainfall (mm) | Weather data |
| AQI | Air quality data |
| Feels-like temperature | Weather data |
| Wind speed | Weather data |
| Curfew / protest flag (0 or 1) | News pipeline |
| Road closure flag (0 or 1) | Civic alerts |
| Order density | Simulated for now |
| Active driver count in cell | App GPS |
| Hour of day, day of week | System |
| Festival flag (0 or 1) | Public calendar |



#### What the Model Predicts

- Did each trigger type fire? (binary per trigger type)
- Expected payout amount in rupees (regression)



#### Training

No real claims data exists yet so we bootstrap using synthetic labels constructed from known historical disruption events such as Chennai 2015 floods, Delhi 2023 smog, and Bengaluru 2022 waterlogging. We know these happened, we know which zones were hit, so we can construct ground truth labels.

**Dataset split:** 70% train / 15% validation / 15% test

**Loss function:**
```
Total Loss = Binary Cross Entropy (triggers) + lambda x MSE (payout amount)
```

**Key hyperparameters:**

| Parameter | Value |
|---|---|
| GCN layers | 2 |
| Transformer layers | 3 |
| Attention heads | 4 |
| Learning rate | 0.001 |
| Batch size | 32 |
| Early stopping patience | 5 epochs |

**Target metrics:**

| Metric | Target |
|---|---|
| Trigger F1 Score | > 0.85 |
| Payout MAE | < Rs. 50 |
| AUC-ROC | > 0.90 |

The model is retrained every Sunday night on the week's new claims data. The new model only replaces production if it outperforms the existing one.



#### Cold Start Handling

Workers with less than 14 days of history fall back to their H3 zone's regional average risk score. A 1.2x multiplier is applied to their premium as a buffer until sufficient personal history builds up.



#### Fraud Detection

Four layers running in parallel with the trigger engine:

1. **Data validation** - confirm the event actually occurred via independent sources
2. **GPS cross-check** - worker's coarse location (sampled every 15-20 min) must intersect the affected H3 zone during the event window
3. **Personal anomaly check** - claim frequency is flagged if it exceeds 2 standard deviations above the worker's own 8-week rolling average
4. **Cohort check** - if 200 workers are insured in a flooded zone, Float expects 60-90% to trigger. If only 1 claims, or if 100% claim but platform order data shows only a 30% drop, both cases get flagged

**Speed-based validation** uses the base speed formula derived from the worker's own delivery history:

```
μ (mu)= mean delivery speed across all past orders
σ (sigma) = standard deviation of delivery speed

Flag if: current_speed < μ - 3*σ
```

A drop beyond 3σ has a 0.03% natural probability of occurring, which statistically confirms the disruption was real and not fabricated.

**Fraud score routing:**

| Score | Action |
|---|---|
| Below 30 | Auto approve |
| 30 to 70 | Approve, flag for weekly review |
| Above 70 | Hold, escalate to manual review |

---

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

To prevent fraudulent claims, we implement intelligent fraud detection focusing on location and activity validation. GPS coordinates are sampled every 2 minutes and converted to an H3 cell at resolution 9 to 10. A sliding window of the last N pings forms the worker's trajectory. 

Validation checks run on every new ping:
* **Speed Check:** Calculated as H3 distance / time delta. A bike has a realistic max of 50 km/h. We flag speeds greater than 80 km/h between pings. On foot, we flag speeds greater than 15 km/h.
* **Hop Continuity Check:** Grid distance must be less than or equal to the expected hops for the transport mode. A teleport from one cell to a distant cell in 2 minutes is flagged, regardless of stated speed.
* **Trajectory Smoothness:** Sudden direction reversals or zigzag patterns inconsistent with known road networks are scored as anomalies.
* **Cell History Consistency:** If a worker claims a disruption in a specific cell, their trajectory must include that cell or its immediate surrounding ring. Claiming a flood disruption in an unvisited cell results in an automatic flag for review.

**Scoring Logic:**
Each ping produces a spoof score between 0 and 1.
* If rolling average spoof score > 0.6: Claim is auto-rejected and sent to a human moderator.
* If rolling average spoof score > 0.85: Account is flagged and security deposit is partially held.

