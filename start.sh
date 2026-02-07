#!/bin/bash

# Startup script for XRP Farmer Docker Environment

echo "🌱 Starting XRP Farmer Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

echo "🚀 Building and starting containers..."
# Run docker-compose up with build, detach mode optional but user probably wants to see logs if it's a "startup" script for dev.
# I will run it in attached mode so they can see logs, with a clear exit message.

docker-compose up --build

echo "🛑 Containers stopped."
