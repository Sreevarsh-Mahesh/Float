## Parametric Triggers
In typical insurance systems, a worker submits a claim and waits forever for it to be approved. Float, on the other hand, uses parametric triggers that are already set, measurable thresholds that are limited by real-world events.
When a threshold is passed and the worker's registered H3 zone is affected, the payment happens immediately.
This means that there is no need for paperwork, waiting, or even arguments. Also, the workers don't need to register a claim by hand with Float.

| Trigger | Threshold | Daily Cap |
|---|---|---|
| Heavy Rain / Red Alert | Rainfall > 20mm/hr for 2+ hrs | ₹750/day |
| Severe AQI | AQI > 300 in zone | ₹600/day |
| Extreme Heat | Temp > 43°C with official advisory | ₹450/day |
| Curfew / Section 144 | Declared zone matches worker's H3 cell | ₹900/day |
| City-wide Bandh | Verified via official sources + order volume drop | ₹900/day |

## Data Sources
Trigger conditions will be validated using publicly available weather, air quality and civic alert data sources. 
Final API selection is in progress.

### Excluded
Oversupply, order rejections and delays on the restaurant side. 
These situations cannot be independently verified by Float. 
Only the platforms(Swiggy, Zomato) themselves can have that sort of information, which neither the worker nor Float can check.
These events are unverifiable and prone to abuse.
