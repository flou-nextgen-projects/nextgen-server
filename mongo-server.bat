CD/
C:
CD "C:\Program Files\MongoDB\Server\8.0\bin"
REM mongod.exe --dbpath E:\mongodb-databases --directoryperdb --port 27000 --bind_ip 127.0.0.1 --auth
mongod.exe --port 27000 --bind_ip 127.0.0.1 --auth --dbpath E:\mongodb-databases --directoryperdb --tlsMode requireTLS --tlsCertificateKeyFile "E:\nextgen-projects\nextgen-server\dist\certificates\mongodb-server.pem" --tlsCAFile "E:\nextgen-projects\nextgen-server\dist\certificates\rootCA.pem"