#!/bin/sh

while [ 1 ]; do
	ab -n 1000000 -c 1 -r -s 5 http://www.hicount.org:8080/hit?id=7
	sleep 0.5
done
