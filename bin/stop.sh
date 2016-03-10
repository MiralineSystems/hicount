#!/bin/sh

pid=`ps ax | grep nodejs | grep app.js | grep -v grep | awk {'print $1'}`;
if [ -n "$pid" ]; then 
	echo Stopping PID=$pid
	kill $pid
	while [ -d "/proc/$pid" ]; do
		sleep 0.1
	done
	echo Stopped PID=$pid
fi
