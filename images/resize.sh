
assert() {
	if [ ! $1 ]; then
		echo "Assertion failed"
		exit
	fi
}

assert "-d original"


resizeOriginalImagesToArea() {
	if [ ! -d "area$1" ]; then
		echo "generating area$1"
		cd original
		mkdir "area$1"
		ls -1 *.jpg | parallel -j 4 convert "{}" -resize "$1@" "area$1/{}"
		mv "area$1" ..
		cd ..
	fi
}

# in pixels
resizeOriginalImagesToArea 1000
resizeOriginalImagesToArea 10000
resizeOriginalImagesToArea 100000
resizeOriginalImagesToArea 1000000

echo "done"
