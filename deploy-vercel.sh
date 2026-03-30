#!/bin/bash
VERCEL_TOKEN="vcp_5Tg8hDugyIg9NDyESBzvXxwqoJAz07snMM6tFPvqVBAEma5P4D0AY7X4"
PROJECT_NAME="mobi-repair"

# Get list of existing projects
echo "Checking Vercel projects..."
PROJECTS=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects" | grep -o '"name":"[^"]*"' | head -5)

echo "Found projects: $PROJECTS"

# Create deployment
echo "Creating deployment..."
DEPLOYMENT=$(curl -s -X POST \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.vercel.com/v13/deployments" \
  -d '{
    "name": "'$PROJECT_NAME'",
    "files": [],
    "projectSettings": {
      "buildCommand": "npx expo export -p web",
      "outputDirectory": "dist"
    }
  }')

echo $DEPLOYMENT | head -100
