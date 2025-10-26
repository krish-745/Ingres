--- STEP A: Create all 6 tables ---

-- 1. groundwater_assessment (Public)
CREATE TABLE groundwater_assessment (
    State TEXT,
    District TEXT,
    Block TEXT,
    Year INT,
    Recharge_mcm DECIMAL(10, 2),
    Extraction_mcm DECIMAL(10, 2),
    Stage_pct DECIMAL(5, 1),
    Category TEXT
);

-- 2. rainfall_data (Public)
CREATE TABLE rainfall_data (
    State TEXT,
    District TEXT,
    Year INT,
    Annual_Rainfall_mm DECIMAL(7, 1),
    Rainfall_Deviation_pct DECIMAL(5, 1),
    Rainfall_Category TEXT
);

-- 3. well_monitoring (Restricted)
CREATE TABLE well_monitoring (
    Well_ID TEXT,
    State TEXT,
    District TEXT,
    Block TEXT,
    Month TEXT,
    Year INT,
    Depth_to_Water_m DECIMAL(6, 2),
    Observation_Type TEXT
);

-- 4. extraction_sources (Restricted)
CREATE TABLE extraction_sources (
    State TEXT,
    District TEXT,
    Year INT,
    Sector TEXT,
    Extraction_mcm DECIMAL(10, 2)
);

-- 5. policy_zones (Public)
CREATE TABLE policy_zones (
    State TEXT,
    District TEXT,
    Block TEXT,
    Zone_Type TEXT,
    Notification_Year INT -- Stored as integer, can be NULL
);

-- 6. recharge_structures (Restricted)
CREATE TABLE recharge_structures (
    Project_ID TEXT,
    State TEXT,
    District TEXT,
    Structure_Type TEXT,
    Capacity_mcm DECIMAL(8, 2),
    Year_Completed INT,
    Status TEXT
);

--- STEP B: Copy data from CSVs into the new tables ---
--- This command assumes the CSVs are in the same directory ---

\copy groundwater_assessment FROM 'groundwater_assessment.csv' WITH (FORMAT CSV, HEADER);
\copy rainfall_data FROM 'rainfall_data.csv' WITH (FORMAT CSV, HEADER);
\copy well_monitoring FROM 'well_monitoring.csv' WITH (FORMAT CSV, HEADER);
\copy extraction_sources FROM 'extraction_sources.csv' WITH (FORMAT CSV, HEADER);
\copy policy_zones FROM 'policy_zones.csv' WITH (FORMAT CSV, HEADER);
\copy recharge_structures FROM 'recharge_structures.csv' WITH (FORMAT CSV, HEADER);

--- End of Script ---