@ECHO OFF
ECHO ===========================================================================================
ECHO Start typescript server (watch mode), babel (watch mode) and nodemon(watch mode).
ECHO ===========================================================================================
START CMD /c "npm run watch-ts"
PAUSE
START CMD /c "npm run watch-node"