import httpx
from datetime import date, timedelta
from typing import Dict, Any

class WeatherService:
    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    async def fetch_history_7d(self, lat: float, lon: float, end_date: date = None) -> Dict[str, Any]:
        """
        Fetches hourly weather data for the last 7 days (including today/end_date).
        Variables: temperature_2m, relative_humidity_2m, precipitation
        """
        if end_date is None:
            end_date = date.today()
            
        start_date = end_date - timedelta(days=7) 
        
        # Determine API Endpoint
        days_diff = (date.today() - end_date).days
        if days_diff > 14:
            base_url = "https://archive-api.open-meteo.com/v1/archive"
        else:
            base_url = "https://api.open-meteo.com/v1/forecast"

        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,relative_humidity_2m,precipitation",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "timezone": "auto"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(base_url, params=params, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                return data
            except httpx.HTTPError as e:
                # In production, log this.
                print(f"Error fetching weather data: {e}")
                raise e

# Validates connectivity
if __name__ == "__main__":
    import asyncio
    async def main():
        service = WeatherService()
        # Test coordinates (e.g. Iowa)
        data = await service.fetch_history_7d(41.8780, -93.0977)
        print("Fetched keys:", data.keys())
        if 'hourly' in data:
            print("Hourly data points:", len(data['hourly']['time']))
    
    asyncio.run(main())
