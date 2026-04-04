"""Initial schema — FLOAT

Revision ID: 001
Revises:
Create Date: 2026-04-04

Covers:
  - Extensions (uuid-ossp, postgis, pg_trgm)
  - All 8 enum types
  - 19 tables with indexes and constraints
  - Partitioned tables: gps_pings (by month), h3_cell_snapshots (by week)
  - Materialized view: worker_earnings_stats
  - DB triggers: set_updated_at on 6 tables
  - Seed data: 14 trigger_config rows
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ─────────────────────────────────────────────
    # 0. EXTENSIONS
    # ─────────────────────────────────────────────
    conn.execute(sa.text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
    conn.execute(sa.text('CREATE EXTENSION IF NOT EXISTS "postgis"'))
    conn.execute(sa.text('CREATE EXTENSION IF NOT EXISTS "pg_trgm"'))

    # ─────────────────────────────────────────────
    # 1. ENUM TYPES
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE coverage_tier_enum AS ENUM ('basic','protection','advanced');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE policy_status_enum AS ENUM ('active','paused','expired','cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE trigger_category_enum AS ENUM (
                'environmental','acts_of_god','road_anomaly','market_delay','social_infrastructure'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE trigger_type_enum AS ENUM (
                'rain','aqi','extreme_heat','flood','landslide',
                'earthquake','cyclone','road_closure','speed_anomaly',
                'platform_downtime','oversupply_delay','protest','curfew','cell_tower_outage'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE claim_status_enum AS ENUM (
                'pending','auto_approved','flagged_review','manual_review',
                'approved','rejected','paid'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE transport_mode_enum AS ENUM ('bike','bicycle','foot','car');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE platform_enum AS ENUM ('zomato','swiggy','blinkit','zepto','dunzo','other');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE model_stage_enum AS ENUM ('training','staging','production','retired');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))

    # ─────────────────────────────────────────────
    # 2. WORKERS
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS workers (
            id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            phone                       VARCHAR(15) UNIQUE NOT NULL,
            full_name                   VARCHAR(120) NOT NULL,
            date_of_birth               DATE,
            kyc_verified                BOOLEAN DEFAULT FALSE,
            kyc_verified_at             TIMESTAMPTZ,
            transport_mode              transport_mode_enum NOT NULL DEFAULT 'bike',
            home_h3_cell                TEXT,
            upi_id                      VARCHAR(100),
            bank_account_no             VARCHAR(30),
            bank_ifsc                   VARCHAR(12),
            device_token                TEXT,
            app_version                 VARCHAR(20),
            is_active                   BOOLEAN DEFAULT TRUE,
            security_deposit_held       FLOAT DEFAULT 0.0,
            created_at                  TIMESTAMPTZ DEFAULT NOW(),
            updated_at                  TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_workers_phone    ON workers(phone)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_workers_h3_cell  ON workers(home_h3_cell)"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS worker_platform_links (
            id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            worker_id           UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
            platform            platform_enum NOT NULL,
            platform_worker_id  VARCHAR(100) NOT NULL,
            verified            BOOLEAN DEFAULT FALSE,
            linked_at           TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (platform, platform_worker_id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_wpl_worker ON worker_platform_links(worker_id)"))

    # ─────────────────────────────────────────────
    # 3. POLICIES & PREMIUMS
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS policies (
            id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            worker_id               UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
            tier                    coverage_tier_enum NOT NULL,
            status                  policy_status_enum NOT NULL DEFAULT 'active',
            coverage_start_date     DATE NOT NULL,
            coverage_end_date       DATE NOT NULL,
            auto_renew              BOOLEAN DEFAULT TRUE,
            premium                 FLOAT NOT NULL,
            baseline_daily_avg      FLOAT,
            baseline_weekly_avg     FLOAT,
            baseline_std_dev        FLOAT,
            is_cold_start           BOOLEAN DEFAULT FALSE,
            cold_start_multiplier   NUMERIC(4,2) DEFAULT 1.00,
            created_at              TIMESTAMPTZ DEFAULT NOW(),
            updated_at              TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_policies_worker       ON policies(worker_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_policies_status_dates ON policies(status, coverage_start_date, coverage_end_date)"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS premium_calculations (
            id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            policy_id               UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
            worker_id               UUID NOT NULL REFERENCES workers(id),
            calculated_at           TIMESTAMPTZ DEFAULT NOW(),
            daily_avg               FLOAT NOT NULL,
            weekly_avg              FLOAT NOT NULL,
            weekly_variance         FLOAT NOT NULL,
            std_dev                 FLOAT NOT NULL,
            anomaly_threshold       FLOAT NOT NULL,
            active_days_in_window   SMALLINT NOT NULL,
            is_cold_start           BOOLEAN DEFAULT FALSE,
            cold_start_multiplier   NUMERIC(4,2) DEFAULT 1.00,
            base_premium            FLOAT NOT NULL,
            final_premium           FLOAT NOT NULL,
            formula_version         VARCHAR(20) NOT NULL DEFAULT 'v1'
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_premcalc_policy ON premium_calculations(policy_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_premcalc_worker ON premium_calculations(worker_id)"))

    # ─────────────────────────────────────────────
    # 4. EARNINGS HISTORY
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS daily_earnings (
            id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            worker_id               UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
            earning_date            DATE NOT NULL,
            gross_earnings          FLOAT NOT NULL DEFAULT 0.0,
            orders_completed        SMALLINT DEFAULT 0,
            hours_active            NUMERIC(4,2) DEFAULT 0,
            total_distance_km       NUMERIC(7,2) DEFAULT 0,
            platform                platform_enum,
            avg_speed_kmh           NUMERIC(5,2),
            std_dev_speed_kmh       NUMERIC(5,2),
            is_verified             BOOLEAN DEFAULT FALSE,
            is_anomaly              BOOLEAN DEFAULT FALSE,
            source                  VARCHAR(30) DEFAULT 'platform_api',
            created_at              TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (worker_id, earning_date, platform)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_earnings_worker_date ON daily_earnings(worker_id, earning_date DESC)"))

    conn.execute(sa.text("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS worker_earnings_stats AS
        SELECT
            worker_id,
            COUNT(*)                                              AS total_active_days,
            AVG(gross_earnings)                                   AS daily_avg,
            SUM(gross_earnings) / NULLIF(7.0, 0)                 AS weekly_avg,
            SUM(gross_earnings) / NULLIF(30.0, 0)                AS monthly_avg,
            VARIANCE(gross_earnings)                              AS weekly_variance,
            STDDEV(gross_earnings)                                AS std_dev,
            3 * STDDEV(gross_earnings)                            AS anomaly_threshold,
            AVG(avg_speed_kmh)                                    AS avg_speed_kmh,
            AVG(std_dev_speed_kmh)                                AS avg_speed_std_dev,
            MIN(earning_date)                                     AS earliest_record,
            MAX(earning_date)                                     AS latest_record
        FROM daily_earnings
        WHERE earning_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY worker_id
    """))
    conn.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS idx_wes_worker ON worker_earnings_stats(worker_id)"))

    # ─────────────────────────────────────────────
    # 5. H3 SPATIAL GRID
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS h3_cells (
            h3_index                TEXT PRIMARY KEY,
            resolution              SMALLINT NOT NULL DEFAULT 9,
            city                    VARCHAR(80),
            district                VARCHAR(80),
            state                   VARCHAR(80),
            centroid_lat            NUMERIC(10,7) NOT NULL,
            centroid_lng            NUMERIC(10,7) NOT NULL,
            zone_daily_avg          FLOAT DEFAULT 0.0,
            flood_risk_score        NUMERIC(4,3) DEFAULT 0,
            historical_aqi_avg      NUMERIC(6,2),
            historical_rain_avg_mm  NUMERIC(6,2),
            is_monitored            BOOLEAN DEFAULT TRUE,
            created_at              TIMESTAMPTZ DEFAULT NOW(),
            updated_at              TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_h3_city      ON h3_cells(city)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_h3_monitored ON h3_cells(is_monitored) WHERE is_monitored = TRUE"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS h3_cell_snapshots (
            id                          BIGSERIAL,
            h3_index                    TEXT NOT NULL REFERENCES h3_cells(h3_index),
            snapshot_at                 TIMESTAMPTZ NOT NULL,
            rainfall_mm                 NUMERIC(6,2) DEFAULT 0,
            aqi                         NUMERIC(6,2) DEFAULT 0,
            feels_like_temp_c           NUMERIC(5,2),
            wind_speed_kmh              NUMERIC(5,2),
            curfew_flag                 BOOLEAN DEFAULT FALSE,
            protest_flag                BOOLEAN DEFAULT FALSE,
            road_closure_flag           BOOLEAN DEFAULT FALSE,
            cell_outage_flag            BOOLEAN DEFAULT FALSE,
            order_density               NUMERIC(8,2) DEFAULT 0,
            active_driver_count         SMALLINT DEFAULT 0,
            platform_downtime_flag      BOOLEAN DEFAULT FALSE,
            hour_of_day                 SMALLINT NOT NULL,
            day_of_week                 SMALLINT NOT NULL,
            is_festival_day             BOOLEAN DEFAULT FALSE,
            predicted_risk_score        NUMERIC(5,4),
            predicted_payout            FLOAT,
            trigger_flags               JSONB,
            model_version_id            UUID,
            inference_latency_ms        INTEGER,
            data_source                 VARCHAR(50) DEFAULT 'weather_api',
            created_at                  TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (id, snapshot_at)
        ) PARTITION BY RANGE (snapshot_at)
    """))
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS h3_cell_snapshots_2025_w01 PARTITION OF h3_cell_snapshots
            FOR VALUES FROM ('2025-01-01') TO ('2025-01-08')
    """))
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS h3_cell_snapshots_2026_w14 PARTITION OF h3_cell_snapshots
            FOR VALUES FROM ('2026-04-01') TO ('2026-04-08')
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_snap_h3_time      ON h3_cell_snapshots(h3_index, snapshot_at DESC)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_snap_trigger_flags ON h3_cell_snapshots USING GIN(trigger_flags)"))

    # ─────────────────────────────────────────────
    # 6. GPS TRAJECTORY & PINGS
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS gps_pings (
            id              BIGSERIAL,
            worker_id       UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
            pinged_at       TIMESTAMPTZ NOT NULL,
            latitude        NUMERIC(10,7) NOT NULL,
            longitude       NUMERIC(10,7) NOT NULL,
            h3_index_r9     TEXT,
            h3_index_r10    TEXT,
            accuracy_m      NUMERIC(6,2),
            is_online       BOOLEAN DEFAULT TRUE,
            speed_kmh       NUMERIC(6,2),
            hop_distance    SMALLINT,
            spoof_score     NUMERIC(4,3) DEFAULT 0,
            is_flagged      BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (id, pinged_at)
        ) PARTITION BY RANGE (pinged_at)
    """))
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS gps_pings_2025_01 PARTITION OF gps_pings
            FOR VALUES FROM ('2025-01-01') TO ('2025-02-01')
    """))
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS gps_pings_2026_04 PARTITION OF gps_pings
            FOR VALUES FROM ('2026-04-01') TO ('2026-05-01')
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_gps_worker_time ON gps_pings(worker_id, pinged_at DESC)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_gps_h3          ON gps_pings(h3_index_r9, pinged_at DESC)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_gps_flagged     ON gps_pings(is_flagged) WHERE is_flagged = TRUE"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS worker_spoof_profiles (
            worker_id               UUID PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
            rolling_spoof_score     NUMERIC(4,3) DEFAULT 0,
            spoof_score_8w_avg      NUMERIC(4,3) DEFAULT 0,
            total_flagged_pings     INTEGER DEFAULT 0,
            total_pings             INTEGER DEFAULT 0,
            last_evaluated_at       TIMESTAMPTZ,
            updated_at              TIMESTAMPTZ DEFAULT NOW()
        )
    """))

    # ─────────────────────────────────────────────
    # 7. TRIGGER EVENTS
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS trigger_events (
            id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            h3_index                TEXT NOT NULL REFERENCES h3_cells(h3_index),
            category                trigger_category_enum NOT NULL,
            trigger_type            trigger_type_enum NOT NULL,
            event_start             TIMESTAMPTZ NOT NULL,
            event_end               TIMESTAMPTZ,
            duration_minutes        INTEGER,
            raw_value               NUMERIC(10,4),
            threshold_value         NUMERIC(10,4),
            scaling_factor          NUMERIC(5,4) DEFAULT 1.0,
            is_verified             BOOLEAN DEFAULT FALSE,
            verified_via            TEXT[],
            verified_at             TIMESTAMPTZ,
            source_payload          JSONB,
            affected_h3_cells       TEXT[],
            affected_worker_count   INTEGER,
            model_predicted         BOOLEAN,
            model_confidence        NUMERIC(5,4),
            created_at              TIMESTAMPTZ DEFAULT NOW(),
            updated_at              TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_trigger_h3_time    ON trigger_events(h3_index, event_start DESC)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_trigger_type        ON trigger_events(trigger_type)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_trigger_unverified  ON trigger_events(is_verified) WHERE is_verified = FALSE"))

    # ─────────────────────────────────────────────
    # 8. CLAIMS & PAYOUTS
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS claims (
            id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            worker_id                   UUID NOT NULL REFERENCES workers(id),
            policy_id                   UUID NOT NULL REFERENCES policies(id),
            trigger_event_id            UUID NOT NULL REFERENCES trigger_events(id),
            status                      claim_status_enum NOT NULL DEFAULT 'pending',
            triggered_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            evaluated_at                TIMESTAMPTZ,
            resolved_at                 TIMESTAMPTZ,
            daily_avg                   FLOAT NOT NULL,
            coverage_pct                NUMERIC(5,4) NOT NULL,
            scaling_factor              NUMERIC(5,4) NOT NULL,
            trigger_raw_value           NUMERIC(10,4),
            trigger_reference_value     NUMERIC(10,4),
            gross_payout                FLOAT NOT NULL DEFAULT 0.0,
            final_payout                FLOAT NOT NULL DEFAULT 0.0,
            fraud_score                 NUMERIC(5,2) DEFAULT 0,
            fraud_score_detail          JSONB,
            auto_decision               VARCHAR(30),
            manual_reviewer_id          UUID,
            manual_review_note          TEXT,
            worker_in_zone              BOOLEAN,
            trajectory_overlap_pct      NUMERIC(5,2),
            cohort_trigger_rate_pct     NUMERIC(5,2),
            cohort_order_drop_pct       NUMERIC(5,2),
            created_at                  TIMESTAMPTZ DEFAULT NOW(),
            updated_at                  TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_claims_worker  ON claims(worker_id, triggered_at DESC)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_claims_policy  ON claims(policy_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_claims_trigger ON claims(trigger_event_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_claims_status  ON claims(status)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_claims_manual  ON claims(status) WHERE status = 'manual_review'"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS payouts (
            id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            claim_id            UUID NOT NULL REFERENCES claims(id),
            worker_id           UUID NOT NULL REFERENCES workers(id),
            policy_id           UUID NOT NULL REFERENCES policies(id),
            amount              FLOAT NOT NULL,
            payment_method      VARCHAR(30) NOT NULL DEFAULT 'upi',
            payment_reference   VARCHAR(100),
            payment_gateway     VARCHAR(50),
            initiated_at        TIMESTAMPTZ DEFAULT NOW(),
            completed_at        TIMESTAMPTZ,
            failed_at           TIMESTAMPTZ,
            failure_reason      TEXT,
            status              VARCHAR(20) DEFAULT 'initiated',
            retry_count         SMALLINT DEFAULT 0,
            created_at          TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_payouts_claim  ON payouts(claim_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_payouts_worker ON payouts(worker_id, initiated_at DESC)"))

    # ─────────────────────────────────────────────
    # 9. FRAUD AUDIT
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS fraud_audit_records (
            id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            claim_id                        UUID NOT NULL UNIQUE REFERENCES claims(id) ON DELETE CASCADE,
            worker_id                       UUID NOT NULL REFERENCES workers(id),
            evaluated_at                    TIMESTAMPTZ DEFAULT NOW(),
            event_independently_confirmed   BOOLEAN,
            data_sources_checked            TEXT,
            worker_in_affected_zone         BOOLEAN,
            gps_zone_overlap_pct            NUMERIC(5,2),
            gps_pings_during_event          SMALLINT,
            gps_check_passed                BOOLEAN,
            worker_claim_freq_8w            NUMERIC(5,2),
            worker_freq_zscore              NUMERIC(6,3),
            personal_anomaly_flagged        BOOLEAN,
            total_workers_in_zone           INTEGER,
            workers_who_triggered           INTEGER,
            cohort_trigger_rate             NUMERIC(5,4),
            expected_trigger_rate_min       NUMERIC(5,4) DEFAULT 0.60,
            expected_trigger_rate_max       NUMERIC(5,4) DEFAULT 0.90,
            platform_order_drop_rate        NUMERIC(5,4),
            cohort_anomaly_flagged          BOOLEAN,
            worker_mu_speed_kmh             NUMERIC(6,2),
            worker_sigma_speed_kmh          NUMERIC(6,2),
            observed_speed_during_event     NUMERIC(6,2),
            speed_zscore                    NUMERIC(6,3),
            speed_check_passed              BOOLEAN,
            final_fraud_score               NUMERIC(5,2) NOT NULL,
            decision                        VARCHAR(30) NOT NULL
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_fraud_claim ON fraud_audit_records(claim_id)"))

    # ─────────────────────────────────────────────
    # 10. ML MODEL VERSIONING
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS model_versions (
            id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            model_name              VARCHAR(80) NOT NULL DEFAULT 'st_gnn_v1',
            version_tag             VARCHAR(40) NOT NULL,
            stage                   model_stage_enum NOT NULL DEFAULT 'staging',
            hyperparameters         JSONB NOT NULL,
            train_start             TIMESTAMPTZ,
            train_end               TIMESTAMPTZ,
            training_data_from      DATE,
            training_data_to        DATE,
            train_samples           INTEGER,
            val_samples             INTEGER,
            test_samples            INTEGER,
            trigger_f1_score        NUMERIC(5,4),
            payout_mae              FLOAT,
            auc_roc                 NUMERIC(5,4),
            artifact_path           TEXT,
            artifact_checksum       VARCHAR(64),
            promoted_at             TIMESTAMPTZ,
            retired_at              TIMESTAMPTZ,
            notes                   TEXT,
            created_at              TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (model_name, version_tag)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_model_stage ON model_versions(stage)"))

    # ─────────────────────────────────────────────
    # 11. NEWS PIPELINE
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS news_pipeline_events (
            id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            source_url          TEXT,
            source_type         VARCHAR(30),
            raw_headline        TEXT,
            extracted_at        TIMESTAMPTZ DEFAULT NOW(),
            event_type          trigger_type_enum,
            confidence          NUMERIC(5,4),
            is_relevant         BOOLEAN DEFAULT FALSE,
            mentioned_location  TEXT,
            resolved_h3_cells   TEXT[],
            trigger_event_id    UUID REFERENCES trigger_events(id),
            llm_model_used      VARCHAR(60),
            llm_response        JSONB
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_news_type     ON news_pipeline_events(event_type)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_news_relevant ON news_pipeline_events(is_relevant) WHERE is_relevant = TRUE"))

    # ─────────────────────────────────────────────
    # 12. NOTIFICATIONS
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS notifications (
            id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            worker_id           UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
            claim_id            UUID REFERENCES claims(id),
            trigger_event_id    UUID REFERENCES trigger_events(id),
            notification_type   VARCHAR(50) NOT NULL,
            title               VARCHAR(150) NOT NULL,
            body                TEXT NOT NULL,
            sent_at             TIMESTAMPTZ,
            delivered_at        TIMESTAMPTZ,
            read_at             TIMESTAMPTZ,
            delivery_status     VARCHAR(20) DEFAULT 'pending',
            payload             JSONB,
            created_at          TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_notif_worker ON notifications(worker_id, created_at DESC)"))

    # ─────────────────────────────────────────────
    # 13. TRIGGER CONFIG
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS trigger_config (
            id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            trigger_type                trigger_type_enum NOT NULL UNIQUE,
            threshold_value             NUMERIC(10,4) NOT NULL,
            threshold_unit              VARCHAR(20),
            scaling_factor              NUMERIC(5,4) NOT NULL DEFAULT 1.0,
            max_payout                  FLOAT,
            tier_threshold_basic        SMALLINT,
            tier_threshold_protection   SMALLINT,
            tier_threshold_advanced     SMALLINT,
            is_active                   BOOLEAN DEFAULT TRUE,
            effective_from              TIMESTAMPTZ DEFAULT NOW(),
            updated_by                  TEXT,
            notes                       TEXT,
            created_at                  TIMESTAMPTZ DEFAULT NOW(),
            updated_at                  TIMESTAMPTZ DEFAULT NOW()
        )
    """))

    # Seed trigger_config
    conn.execute(sa.text("""
        INSERT INTO trigger_config (trigger_type, threshold_value, threshold_unit, scaling_factor) VALUES
            ('rain',              10.0,  'mm',        0.80),
            ('aqi',              200.0,  'AQI_index', 0.70),
            ('extreme_heat',       1.0,  'boolean',   0.60),
            ('flood',              1.0,  'boolean',   1.00),
            ('landslide',          1.0,  'boolean',   1.00),
            ('earthquake',         1.0,  'boolean',   1.00),
            ('cyclone',            1.0,  'boolean',   1.00),
            ('road_closure',       1.0,  'boolean',   0.75),
            ('speed_anomaly',      3.0,  'sigma',     0.75),
            ('platform_downtime',  1.0,  'boolean',   0.65),
            ('oversupply_delay',   1.0,  'boolean',   0.50),
            ('protest',            1.0,  'boolean',   0.80),
            ('curfew',             1.0,  'boolean',   1.00),
            ('cell_tower_outage',  1.0,  'boolean',   0.70)
        ON CONFLICT (trigger_type) DO NOTHING
    """))

    # ─────────────────────────────────────────────
    # 14. AUDIT LOG
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id          BIGSERIAL PRIMARY KEY,
            actor_type  VARCHAR(20) NOT NULL,
            actor_id    TEXT,
            action      VARCHAR(80) NOT NULL,
            entity_type VARCHAR(50),
            entity_id   TEXT,
            old_value   JSONB,
            new_value   JSONB,
            ip_address  INET,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor_id, created_at DESC)"))

    # ─────────────────────────────────────────────
    # 15. VIEWS
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE OR REPLACE VIEW v_active_worker_dashboard AS
        SELECT
            w.id                        AS worker_id,
            w.full_name,
            w.phone,
            w.transport_mode,
            p.tier,
            p.status                    AS policy_status,
            p.coverage_start_date,
            p.coverage_end_date,
            p.premium,
            p.is_cold_start,
            es.daily_avg,
            es.weekly_avg,
            es.std_dev,
            es.anomaly_threshold,
            es.total_active_days,
            sp.rolling_spoof_score,
            sp.spoof_score_8w_avg,
            w.home_h3_cell
        FROM workers w
        JOIN policies p              ON p.worker_id = w.id AND p.status = 'active'
        LEFT JOIN worker_earnings_stats es ON es.worker_id = w.id
        LEFT JOIN worker_spoof_profiles sp ON sp.worker_id = w.id
        WHERE w.is_active = TRUE
    """))

    conn.execute(sa.text("""
        CREATE OR REPLACE VIEW v_claims_pipeline AS
        SELECT
            c.id,
            c.status,
            c.triggered_at,
            c.fraud_score,
            c.final_payout,
            c.worker_in_zone,
            c.cohort_trigger_rate_pct,
            w.full_name,
            w.phone,
            te.trigger_type,
            te.h3_index,
            te.event_start
        FROM claims c
        JOIN workers w          ON w.id = c.worker_id
        JOIN trigger_events te  ON te.id = c.trigger_event_id
        ORDER BY c.triggered_at DESC
    """))

    # ─────────────────────────────────────────────
    # 16. DB TRIGGERS — set_updated_at
    # ─────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """))

    for table in ["workers", "policies", "claims", "trigger_events", "h3_cells", "trigger_config"]:
        conn.execute(sa.text(f"""
            DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};
            CREATE TRIGGER trg_{table}_updated_at
                BEFORE UPDATE ON {table}
                FOR EACH ROW EXECUTE FUNCTION set_updated_at()
        """))


def downgrade() -> None:
    conn = op.get_bind()

    # Drop views
    conn.execute(sa.text("DROP VIEW IF EXISTS v_claims_pipeline"))
    conn.execute(sa.text("DROP VIEW IF EXISTS v_active_worker_dashboard"))

    # Drop triggers
    for table in ["workers", "policies", "claims", "trigger_events", "h3_cells", "trigger_config"]:
        conn.execute(sa.text(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table}"))
    conn.execute(sa.text("DROP FUNCTION IF EXISTS set_updated_at"))

    # Drop tables in reverse FK order
    for tbl in [
        "audit_log", "notifications", "news_pipeline_events",
        "model_versions", "fraud_audit_records", "payouts", "claims",
        "trigger_config", "trigger_events",
        "worker_spoof_profiles", "gps_pings",
        "h3_cell_snapshots", "h3_cells",
        "worker_earnings_stats",   # mat. view
        "daily_earnings",
        "premium_calculations", "policies",
        "worker_platform_links", "workers",
    ]:
        conn.execute(sa.text(f"DROP TABLE IF EXISTS {tbl} CASCADE"))

    conn.execute(sa.text("DROP MATERIALIZED VIEW IF EXISTS worker_earnings_stats CASCADE"))

    # Drop enum types
    for enum in [
        "coverage_tier_enum", "policy_status_enum", "trigger_category_enum",
        "trigger_type_enum", "claim_status_enum", "transport_mode_enum",
        "platform_enum", "model_stage_enum",
    ]:
        conn.execute(sa.text(f"DROP TYPE IF EXISTS {enum} CASCADE"))
