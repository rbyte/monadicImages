
assert() {
	if [ ! $1 ]; then
		echo "Assertion failed"
		exit
	fi
}

assert "-d original"


resizeOriginalImagesToArea() {
	if [ ! -d "area$1" ]; then
		cd original
		mkdir "area$1"
		ls -1 *.jpg | parallel -j 4 convert "{}" -resize "$1@" "area$1/{}"
		mv "area$1" ..
		cd ..
	fi
}

# in pixels
resizeOriginalImagesToArea 10000
resizeOriginalImagesToArea 100000
resizeOriginalImagesToArea 1000000

create2DcomparisionMatrix() {
	# http://www.imagemagick.org/script/command-line-options.php#metric
	# perceptual hash
	# compare -metric PHASH 38331.jpg 38310.jpg /dev/null 2> aaafile.txt
	# for f in *.jpg; do echo "$f"; done
	# ls -1 *.jpg | parallel -j 4 "compare -metric PHASH 38310.jpg {} /dev/null 2> {}.txt"
	
	if [ ! -d "area10000/comparison" ]; then
		# only use the small images! for performance
		cd area10000
		mkdir comparison
		for f in *.jpg; do ls -1 *.jpg | parallel -j 4 "compare -metric PHASH ${f} {} /dev/null 2> comparison/${f}~{}"; done

		rm compare.json
		# build json
		echo "[" >> compare.json
		for f in comparison/*; do echo "['$f', $(cat $f)]," >> compare.json; done
		sed -i "s/comparison\///g" compare.json
		sed -i "s/~/', '/g" compare.json
		# json does not allow single quotes for strings
		sed -i "s/'/\"/g" compare.json
		# prepend [
		#sed -i '1s;^;[;' compare.json
		# delete last character in file: ","
		sed -i '$ s/.$//' compare.json
		# append list end ]
		echo ']' >> compare.json
		cd ..
	fi
}

create2DcomparisionMatrix

createJSONthatListsAllImages() {
	cd original
	rm fileList.json
	echo "[" >> fileList.json
	for f in *.jpg; do echo "\"$f\"," >> fileList.json; done
	sed -i '$ s/.$//' fileList.json
	echo "]" >> fileList.json
	cd ..
}

createJSONthatListsAllImages

node generateCompareMatrix.js

echo "done"
