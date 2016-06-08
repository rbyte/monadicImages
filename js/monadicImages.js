/*
 *	Matthias Graf
 *	matthias.graf@mgrf.de
 *	2016
 *	GNU AGPL v3
 */

const τ = Math.PI*2
const availableImageSizesByArea = [1000, 10000, 100000, 1000000]
const availableImageSizesByAreaToPreload = [true, false, false, false]
const jsons = ["images/images.json"]
const distortCircleIntoCanvasRectangle = true
const titelKeilAngle = τ*0.1 // 360° * 10%
// alpha = 0 is EAST. start with:
var currentAlpha = τ*0.5+titelKeilAngle*0.5

var canvasContainer
var pixiRenderer
var stage

var w = 1500
var h = 800

var rStart = 0.19
var rEnd = 1.00
var scaleStart = 0.7
var scaleEnd = 1.8
var powerSimilarity = 1
var powerScale = 0.5

var rStartGrowth = 0.02
var rEndGrowth = 0.02
var scaleStartGrowth = 0
var scaleEndGrowth = 0
var powerSimilarityGrowth = 0.075
var powerScaleGrowth = 0.15


var min = {
	rStart: 0.05,
	rEnd: 0.8,
	scaleStart: 0.1,
	scaleEnd: 1.0,
	powerSimilarity: 0,
	powerScale: 0,
	
	rStartGrowth: -0.1,
	rEndGrowth: -0.1,
	scaleStartGrowth: -0.1,
	scaleEndGrowth: -0.1,
	powerSimilarityGrowth: -0.1,
	powerScaleGrowth: -0.1,
}

var max = {
	rStart: 0.55,
	rEnd: 2.5,
	scaleStart: 1.0,
	scaleEnd: 2.8,
	powerSimilarity: 15,
	powerScale: 7,
	
	rStartGrowth: 0.2,
	rEndGrowth: 0.2,
	scaleStartGrowth: 0.2,
	scaleEndGrowth: 0.2,
	powerSimilarityGrowth: 0.2,
	powerScaleGrowth: 0.2,
}

var step = {
	rStart: 0.05,
	rEnd: 0.05,
	scaleStart: 0.05,
	scaleEnd: 0.05,
	powerSimilarity: 0.05,
	powerScale: 0.05,
	
	rStartGrowth: 0.005,
	rEndGrowth: 0.005,
	scaleStartGrowth: 0.005,
	scaleEndGrowth: 0.005,
	powerSimilarityGrowth: 0.005,
	powerScaleGrowth: 0.005,
}


var lastMouseOverSprite
var transition = false

var images
var centeredImage

function init() {
	withLoadedJSONfiles(jsons, function([imgs]) {
		images = imgs
		// retain indices for later referencing (after sort reordered array)
		// important for similarity indices
		images.forEach((e,i) => e.index = i)
		images.forEach(e => e.areaIdxUsed = 0) // default is smallest
		images.forEach(e => e.textures = new Array(availableImageSizesByArea.length).fill(false))
		images.forEach(e => e.getPath = function(areaIdx = this.areaIdxUsed) {
			return "images/area"+availableImageSizesByArea[areaIdx]+"/"+this.file
		})
		images.forEach(e => e.date = e.date ? undefined : new Date(e.date))
		
		// VAN GOGH ONLY
		// images = prepareVanGoghImages(images)
		
		// low value should be low similarity
		images.forEach(e => e.similarity = e.similarity.map(x => 1-x))
		
		equaliseSimilarity()
		// var flatSim = [].concat(...images.map(e => e.similarity))
		// createHistogram(flatSim)
		
		// if (true) {
		// 	return
		// }
		
		images.sort((a,b) => {
			// compare by date, fall back to compare by name if no date available
			if (!a.date || !b.date)
				return a.file < b.file ? -1 : 1
			return a.date < b.date ? -1 : 1
		})
		
		//var flatSim = [].concat(...images.map(e => e.similarity))
		
		// firefox: about:config: layers.acceleration.draw-fps
		// ~40 fps with 2260 images
		// ~10 fps with 22600 images
		// reduce number of rendered images
		
		//images = images.slice(0, 500)
		
		canvasContainer = document.getElementById("canvasContainer")
		pixiRenderer = new PIXI.WebGLRenderer(w, h, {transparent: true})
		canvasContainer.appendChild(pixiRenderer.view)
		pixiRenderer.view.oncontextmenu = function (e) {
			e.preventDefault()
		}
		stage = new PIXI.Container()
		centeredImage = images[0]
		
		loadAllImages(() => { // then:
			updateImages()
			renderLoop()
			document.querySelector("#loading").style.display = "none"
			
			window.onresize = function(event) { updateScreenElemsSize() }
			window.onresize()
			
			// IE9, Chrome, Safari, Opera
			canvasContainer.addEventListener("mousewheel", wheelMove, false)
			// Firefox
			canvasContainer.addEventListener("DOMMouseScroll", wheelMove, false)
			
			initSlider("rStart")
			initSlider("rStartGrowth")
			initSlider("rEnd")
			initSlider("rEndGrowth")
			initSlider("scaleStart")
			initSlider("scaleStartGrowth")
			initSlider("scaleEnd")
			initSlider("scaleEndGrowth")
			initSlider("powerSimilarity")
			initSlider("powerSimilarityGrowth")
			initSlider("powerScale")
			initSlider("powerScaleGrowth")
		})
		
	})
}

function initSlider(s) {
	// is a top level variable
	console.assert(window[s] !== undefined)
	
	var ul = document.getElementById("controls")
	var li = ul.appendChild(document.createElement("li"))
	var slider = li.appendChild(document.createElement("input"))
	var label = li.appendChild(document.createElement("label"))
	label.setAttribute("for", s)
	slider.setAttribute("id", s)
	slider.setAttribute("type", "range")
	slider.setAttribute("min", min[s])
	slider.setAttribute("max", max[s])
	slider.setAttribute("step", step[s])
	slider.value = window[s]
	slider.setLabel = () => label.innerHTML = s+" "+window[s].toFixed(2)
	slider.setLabel()
	slider.oninput = function(e) {
		window[s] = Number(this.value)
		slider.setLabel()
		updateImages()
	}
}

function updateSlider(s) {
	var slider = document.querySelector("#"+s)
	slider.value = window[s]
	slider.setLabel()
}

function equaliseSimilarity() {
	var flatSim = [].concat(...images.map(e => e.similarity))
	// createHistogram(flatSim)
	
	const buckets = 500
	var uniqueSorted = new Array(buckets).fill(1).map((e,i) => (i+1)/buckets)
	// accumulated histogram
	var accu = uniqueSorted.map(e => flatSim.filter(x => x<=e).length)
	console.assert(accu[accu.length-1] === flatSim.length)
	// into [0,1]
	var normalised = accu.map(e => e/flatSim.length)
	
	var bucketIndex = function(e) {
		var bucket = 0
		while (e > uniqueSorted[bucket])
			bucket++
		return bucket
	}
	
	images.forEach(e => e.similarity = e.similarity.map(e => normalised[bucketIndex(e)]))
}

// synchronise xhr onload for all files
function withLoadedJSONfiles(fileNamesArray, callback) {
	var result = new Array(fileNamesArray.length).fill(false)
	
	fileNamesArray.forEach(function (e, i) {
		var xhr = new XMLHttpRequest()
		xhr.open("GET", e)
		xhr.onload = function() {
			result[i] = JSON.parse(xhr.responseText)
			if (result.every(e => e))
				callback(result)
		}
		xhr.send()
	})
}

function prepareVanGoghImages(images) {
	images.forEach(e => e.date = new Date(e.yearDrawn,1,1,1,1,1,1))
	// VANGOGH images width & height !== image resolution, nor proportional
	// to avoid ambiguity
	images.forEach(e => {
		e.physicalHeight = e.height
		delete e.height
		e.physicalWidth = e.width
		delete e.width
	})
	
	// similarity histogram equalization (specific to VANGOGH)
	images.forEach(e => e.similarity = e.similarity.map(x => Math.pow(x, 0.25)))
	
	var spreadCenterToCorners = x => Math.atan((x-0.5)*6)/2.5+0.5 // [0,1] => [0,1]
	images.forEach(e => e.similarity = e.similarity.map(x => spreadCenterToCorners(x)))
	return images
}

function polarCoordinates(w, h, alpha, r) {
	var center = {x: w/2, y: h/2}
	var x = Math.cos(alpha)*r
	var y = Math.sin(alpha)*r
	var p = {x: center.x + x, y: center.y + y} 
	return p
}

var linearInterpolation = (low, value, high) => low + value * (high-low)

function positionImage(w, h, image) {
	var alpha, r, scale
	
	if (transition) {
		var dt = Date.now() - transition.start
		var progress = dt / transition.durationMS
		if (progress > 1) {
			progress = 1
			transition = false
		}
		
		var start = image.transitionStart
		var end = image
		
		alpha = linearInterpolation(start.alpha, progress, end.alpha)
		r = linearInterpolation(start.r, progress, end.r)
		scale = linearInterpolation(start.scale, progress, end.scale)
	} else {
		alpha = image.alpha
		r = image.r
		scale = image.scale
	}
	var exponent = powerScale < 0
		? 1/(Math.abs(powerScale)+1) // root: will conform scales
		: powerScale+1 // power: will spread scales
	
	if (r < rStart) {
		var rampFrom0up = 1 - r/rStart
		// https://rechneronline.de/funktionsgraphen/
		// decreases size of center image by suppressing the growth of the exponent
		var centerFn = x => 0.8/(x-0.6)
		scale *= 1 + centerFn(exponent) * rampFrom0up
		// console.log(scale, exponent, centerFn(exponent), absoluteScale)
	}
	
	// has scale=1 as center
	var poweredScale = Math.pow(scale, exponent)
	var circleDiameterPX = Math.min(w,h)
	var absoluteScale = poweredScale / Math.sqrt(availableImageSizesByArea[image.areaIdxUsed]) / Math.sqrt(images.length) * circleDiameterPX
	
	r *= circleDiameterPX*0.5
	
	var p = polarCoordinates(w, h, alpha, r)
	
	if (distortCircleIntoCanvasRectangle) {
		if (w > h) {
			p.x = (p.x - w/2) * w/h + w/2
		} else {
			p.y = (p.y - h/2) * h/w + h/2
		}
	}
	
	image.sprite.position.x = p.x
	image.sprite.position.y = p.y
	image.sprite.scale.x = absoluteScale
	image.sprite.scale.y = absoluteScale
	
	// wait before we update the texture (if areaIdxUsed changed) until next round to avoid stutter
	image.sprite.texture = image.textures[image.areaIdxUsed]
	
	// areas delta is x10, flattened to one dimension: sqrt(10) ~= 3
	if (absoluteScale < 0.3 && 0 > image.areaIdxUsed-1)
		switchToThisAreaAndLoadIfNecessary(image, image.areaIdxUsed-1)
	if (absoluteScale > 1.5 && image.areaIdxUsed+1 < availableImageSizesByArea.length)
		switchToThisAreaAndLoadIfNecessary(image, image.areaIdxUsed+1)
}

function switchToThisAreaAndLoadIfNecessary(image, areaToSetTo) {
	if (image.textures[areaToSetTo] === false) {
		image.textures[areaToSetTo] = true // loading
		var loader = new PIXI.loaders.Loader()
		loader.add(image.file, image.getPath(areaToSetTo))
		loader.once('complete', () => {
			image.areaIdxUsed = areaToSetTo
			image.textures[image.areaIdxUsed] = new PIXI.Texture.fromImage(image.getPath())
		})
		loader.load()
	}
	// this should be necessary, but produces errors. hum.
	// else if (image.textures[areaToSetTo] !== true) {
	// 	image.areaIdxUsed = areaToSetTo
	// }
}

function updateScreenElemsSize() {
	var bb = canvasContainer.getBoundingClientRect()
	if (bb.width <= 0 || bb.height <= 0)
		return
	w = bb.width
	h = bb.height
	pixiRenderer.resize(w, h)
}


function wheelMove(e) {
	e.preventDefault()
	var wheelMovement = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)))
	// altKey, ctrlKey, shiftKey
	
	if (e.shiftKey) {
		// Firefox: shift + mouseWheel down => go back in history ...
		powerSimilarity += wheelMovement*0.05
	} else {
		zoom(wheelMovement)
	}
	updateImages()
}


function zoom(sign) {
	if ((sign > 0 && powerScale < max.powerScale) || (sign < 0 && powerScale > min.powerScale)) {
		rStart += sign * rStartGrowth
		rEnd += sign * rEndGrowth
		scaleStart += sign * scaleStartGrowth
		scaleEnd += sign * scaleEndGrowth
		powerSimilarity += sign * powerSimilarityGrowth
		powerScale += sign * powerScaleGrowth
		
		updateSlider("rStart")
		updateSlider("rEnd")
		updateSlider("scaleStart")
		updateSlider("scaleEnd")
		updateSlider("powerSimilarity")
		updateSlider("powerScale")
	}
	updateImages()
}


function loadAllImages(callback) {
	// image loading is not synchronous in PIXI.Texture and PIXI.Sprite.
	// make sure everything is cached before continuing
	var loader = new PIXI.loaders.Loader()
	
	availableImageSizesByAreaToPreload.forEach((e,i) => {
		if (e)
			images.forEach(image => loader.add(image.file+i, image.getPath(i)))
	})
	loader.once('complete', () => {
		console.log("all done loading!")
		images.forEach(image => initImage(image))
		console.assert(images.every(e => e.sprite))
		callback()
	})
	loader.load()
}

function initImage(image) {
	availableImageSizesByAreaToPreload.forEach((e,i) => {
		if (e)
			image.textures[i] = new PIXI.Texture.fromImage(image.getPath(i))
	})
	
	var sprite = new PIXI.Sprite(image.textures[image.areaIdxUsed])
	console.assert(sprite)
	image.sprite = sprite
	
	image.alpha = currentAlpha
	currentAlpha += 1/images.length*(τ-titelKeilAngle)
	
	sprite.interactive = true
	// turns pointer to hand on mouseover
	//sprite.buttonMode = true
	
	sprite.on("mousedown", function(e) {
		if (image === centeredImage) {
			console.log(e.data.originalEvent)
			if (e.data.originalEvent.buttons === 1)
				zoom(1)
			// TODO mousedown does not trigger on right clicks ... dont know why
			if (e.data.originalEvent.buttons === 2)
				zoom(-1)
		} else {
			updateImages(image)
		}
	})
	sprite.on("mouseover", function(e) {
		var that = this
		lastMouseOverSprite = this
		setTimeout(function() {
			if (that === lastMouseOverSprite) {
				moveToFront(that)
				if (that !== centeredImage.sprite)
					moveToBack(centeredImage.sprite)
			}
		}, 300 /*ms*/)
	})
	
	sprite.anchor.x = 0.5
	sprite.anchor.y = 0.5
	stage.addChild(sprite)
}

function startTransition() {
	transition = {
		start: Date.now(),
		durationMS: 300
	}
	images.forEach(e => {
		e.transitionStart = {
			r: e.r,
			alpha: e.alpha,
			scale: e.scale
		}
	})
}

function moveToFront(sprite) {
	// z-Index is determined by the order of the stage.children array. rearmost are on top
	// stage.children.sort((a,b) => ...)
	// move to front
	stage.removeChild(sprite)
	stage.addChild(sprite)
}

function moveToBack(sprite) {
	stage.setChildIndex(sprite, 0)
	// stage.removeChild(sprite)
	// stage.addChild(sprite)
}

function updateImages(newCenter = centeredImage) {
	centeredImage = newCenter
	
	var infoBox = document.querySelector("#detailedInfo")
	while (infoBox.firstChild) {
		infoBox.removeChild(infoBox.firstChild)
	}
	function addPoint(string) {
		var li = infoBox.appendChild(document.createElement("li"))
		li.appendChild(document.createTextNode(string))
	}
	addPoint(centeredImage.description)
	addPoint(centeredImage.yearDrawn)
	addPoint(centeredImage.keywords)
	addPoint(centeredImage.material)
	
	
	startTransition()
	images.forEach(img => {
		var similarity = centeredImage.similarity[img.index]
		similarity = Math.pow(similarity, powerSimilarity)
		
		img.r = linearInterpolation(rStart, (1-similarity), rEnd)
		img.scale = linearInterpolation(scaleStart, similarity, scaleEnd)
	})
	centeredImage.r = 0
	//centeredImage.scale = centerImageScale
	moveToFront(centeredImage.sprite)
}

function renderLoop() {
	images.forEach(img => positionImage(w, h, img))
	pixiRenderer.render(stage)
	requestAnimationFrame(renderLoop)
}

// default: Generate a Bates distribution of 10 random variables.
function createHistogram(values = d3.range(1000).map(d3.random.bates(10))) {
	var formatCount = d3.format(",.0f");
	
	var margin = {top: 10, right: 30, bottom: 30, left: 30},
		width = 1500 - margin.left - margin.right,
		height = 500 - margin.top - margin.bottom;
	
	var x = d3.scale.linear()
		.domain([0, 1])
		.range([0, width]);

	var data = d3.layout.histogram()
		.bins(x.ticks(100))
		(values);
	
	var y = d3.scale.linear()
		.domain([0, d3.max(data, function(d) { return d.y; })])
		.range([height, 0]);
	
	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom");
	
	var svg = d3.select("body").append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
	
	var bar = svg.selectAll(".bar")
		.data(data)
		.enter().append("g")
		.attr("class", "bar")
		.attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });
	
	bar.append("rect")
		.attr("x", 1)
		.attr("width", x(data[0].dx) - 1)
		.attr("height", function(d) { return height - y(d.y); });
	
	bar.append("text")
		.attr("dy", ".75em")
		.attr("y", 6)
		.attr("x", x(data[0].dx) / 2)
		.attr("text-anchor", "middle")
		.text(function(d) { return formatCount(d.y); });
	
	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis);
}




init()
