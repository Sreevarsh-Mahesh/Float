# FLOAT Backend

## Setup

### 1. Install dependencies
```bash
cd Code/backend
pip install -r requirements.txt
```

### 2. Configure database connection
```bash
cp .env.example .env
# Edit .env and set your DATABASE_URL
```

### 3. Create the database in PostgreSQL
```sql
CREATE DATABASE float_db;
```

### 4. Run migrations
```bash
alembic upgrade head
```

This will create all 19 tables, enums, indexes, partitioned tables,
the materialized view, DB triggers, and seed `trigger_config` with
the 14 default trigger thresholds.

### 5. Verify
```bash
psql -d float_db -c "\dt"
psql -d float_db -c "SELECT trigger_type, threshold_value, scaling_factor FROM trigger_config ORDER BY trigger_type"
```

---

## Money / Financials

All monetary fields are stored as **FLOAT in rupees** (e.g. `premium`,
`gross_earnings`, `final_payout`). There are no `_paise` columns.

---

## Partitioned Tables

| Table | Partition key | Strategy |
|---|---|---|
| `gps_pings` | `pinged_at` | RANGE by month |
| `h3_cell_snapshots` | `snapshot_at` | RANGE by week |

Add new partitions monthly/weekly. Example:
```sql
CREATE TABLE gps_pings_2026_05 PARTITION OF gps_pings
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

---

## Materialized View Refresh

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY worker_earnings_stats;
```

Schedule nightly via pg_cron or an external cron job.
