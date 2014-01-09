
./browser.sh &
node server.js

# old
# # restart the server
# forever stop 0
# # rm ~/.forever/logfile.log
# forever start -m 1 -l logfile.log server.js
# # forever start -m 1 server.js
# # forever logs 0
# # show the output
# # tail -f ~/.forever/logfile.log
