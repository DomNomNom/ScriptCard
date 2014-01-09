sleep 0.5 # wait for the server to be fully setup

# refresh the browser
WID=`xdotool search --name "Script Card" | head -1`
if [ "$WID" = "" ]
then
    WID=`xdotool search --name "localhost" | head -1`
fi
xdotool windowactivate $WID
xdotool key F5

