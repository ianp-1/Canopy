import pandas as pd
import glob
import os


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_PATH = os.path.join(BASE_DIR, "PA_2022_weekly_raw.csv")


# 1. Load all monthly CSVs
files = sorted(glob.glob(os.path.join(DATA_DIR, "HRRR_42_PA_2022-*.csv")))
dfs = []

for f in files:

    print(f"Loading {f}")
    df = pd.read_csv(f)
    dfs.append(df)

raw = pd.concat(dfs, ignore_index=True)

# 2. Create a proper date column
raw["date"] = pd.to_datetime(
    raw[["Year", "Month", "Day"]]
)

# 3. Create week_start (Monday-based weeks)
raw["week_start"] = raw["date"] - pd.to_timedelta(raw["date"].dt.weekday, unit="D")

# 4. Aggregate to county × week
weekly = (
    raw.groupby(["FIPS Code", "County", "week_start"])
    .agg(
        avg_temp_K=("Avg Temperature (K)", "mean"),
        max_temp_K=("Max Temperature (K)", "max"),
        min_temp_K=("Min Temperature (K)", "min"),
        precip_sum=("Precipitation (kg m**-2)", "sum"),
        rh_avg=("Relative Humidity (%)", "mean"),
        wind_speed_avg=("Wind Speed (m s**-1)", "mean"),
        wind_gust_max=("Wind Gust (m s**-1)", "max"),
        vpd_avg=("Vapor Pressure Deficit (kPa)", "mean"),
    )
    .reset_index()
)

# 5. Save
weekly.to_csv(OUTPUT_PATH, index=False)
print(f"Saved weekly dataset to {OUTPUT_PATH}")
