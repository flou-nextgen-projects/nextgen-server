@ECHO off
cd /d E:\nextgen-projects

ECHO Navigating to nextgen-server directory
cd nextgen-server
ECHO Building Docker image for nextgen-server
docker build -f .\dockerfile -t sonawaneyogeshb/nextgen-server:latest .

ECHO Navigating to nextgen-client directory
cd ../nextgen-client
ECHO Building Docker image for nextgen-client
docker build -f .\dockerfile -t sonawaneyogeshb/nextgen-client:latest .

ECHO Navigating to flokapture-ai directory
cd ../flokapture-ai
ECHO Building Docker image for flokapture-ai
docker build -f .\dockerfile -t sonawaneyogeshb/flokapture-ai:latest .

REM ECHO Pushing nextgen-server image to Docker Hub
REM docker push sonawaneyogeshb/nextgen-server:latest
REM ECHO Pushing nextgen-client image to Docker Hub
REM docker push sonawaneyogeshb/nextgen-client:latest
REM ECHO Pushing flokapture-ai image to Docker Hub
REM docker push sonawaneyogeshb/flokapture-ai:latest

ECHO Create Docker Network if not already exists
docker network create nextgen-network

ECHO Starting all docker containers
docker run --name nextgen-server -d -p 9000:9000 -p 9229:9229 --network nextgen-network -e NG_MONGO_HOST=host.docker.internal -e NG_MONGO_PORT=27000 sonawaneyogeshb/nextgen-server:latest
docker run --name flokapture-ai -d -p 3000:3000 -p 9222:9222 --network nextgen-network -e NG_MONGO_HOST=host.docker.internal -e NG_MONGO_PORT=27000 sonawaneyogeshb/flokapture-ai:latest
docker run --name nextgen-client -d -p 443:443 --network nextgen-network sonawaneyogeshb/nextgen-client:latest

ECHO Process completed successfully.