#!/bin/sh

DIR=/projects/counter/www
cd $DIR/static/js/
for i in `/bin/ls app*.js | grep -v min.js`; do
	o=`echo $i | sed s/\.js/.min.js/`;
	echo "Compressing $i => $o";
	java -jar $DIR/bin/yuicompressor-2.4.8.jar $i -o $o
done
