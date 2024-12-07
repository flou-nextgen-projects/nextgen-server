@ECHO OFF
ECHO ===========================================================================================
ECHO  Start MongoDb Server, Start typescript server (watch mode), and nodemon (watch mode).
ECHO ===========================================================================================
START mongo-server.bat
PAUSE
ECHO Waiting for MongoDB server to start...
START CMD /c "npm run watch-ts"
PAUSE
START CMD /c "npm run watch-node"