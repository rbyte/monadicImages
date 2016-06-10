/*
 *	Matthias Graf
 *	matthias.graf@mgrf.de
 *	2016
 *	GNU AGPL v3
 */

const τ = Math.PI*2
const availableImageSizesByArea = [1000, 10000, 100000, 1000000]
const availableImageSizesByAreaToPreload = [true, false, false, false]
const jsons = ["images/images.json", "images/customParameters.json"]
const distortCircleIntoCanvasRectangle = true
const wedgeAngle = τ*0.1 // 360° * 10%
// alpha = 0 is EAST. start with:
var currentAlpha = τ*0.5+wedgeAngle*0.5

var canvasContainer
var pixiRenderer
var stage
var infoBox

var w = 1500
var h = 800

var min = {}, max = {}, step = {}, description = {}
// values can be overwritten via customParameters.json & localStorage
var parameters = {
	// [value, min, max, step, description]
	rStart: [0.19, 0.05, 0.55, 0.05, "Inner Radius"],
	rEnd: [1.00, 0.8, 2.5, 0.05, "Outer Radius"],
	scaleStart: [0.7, 0.1, 1.0, 0.05, "Smallest Size"],
	scaleEnd: [1.4, 1.0, 2.8, 0.05, "Largest Size"],
	powerSimilarity: [1.5, 0, 15, 0.05, "Distribution"],
	powerScale: [0.5, 0, 7, 0.05, "Size Spreading"],
	centerImageScaleExponentIncrease: [0.5, 0, 4, 0.1, "Center Image Size"],
	
	rStartGrowth: [0.02, 0, 0.1, 0.005, "Inner Radius Growth"],
	rEndGrowth: [0.02, 0, 0.1, 0.005, "Outer Radius Growth"],
	scaleStartGrowth: [0, 0, 0.1, 0.005, "Smallest Size Growth"],
	scaleEndGrowth: [0, 0, 0.1, 0.005, "Largest Size Growth"],
	powerSimilarityGrowth: [0.075, 0, 0.2, 0.005, "Distribution Growth"],
	powerScaleGrowth: [0.15, 0, 0.2, 0.005, "Size Distribution Growth"],
}

var lastMouseOverSprite
var transition = false

var images
var centeredImage

function init() {
	withLoadedJSONfiles(jsons, function([imgs, customParameters]) {
		// unpack
		for (let varr in parameters) {
			let [value, _min, _max, _step, _description] = parameters[varr]
			window[varr] = value
			if (customParameters && customParameters[varr])
				window[varr] = customParameters[varr]
			if (localStorage && localStorage.getItem(varr))
				window[varr] = Number(localStorage.getItem(varr))
			console.assert(!isNaN(window[varr]))
			min[varr] = _min
			max[varr] = _max
			step[varr] = _step
			description[varr] = _description
			// parameters[varr] is kept to refer back to defaults
		}
		
		console.assert(imgs instanceof Array)
		images = imgs
		// retain indices for later referencing (after sort reordered array)
		// important for similarity indices
		images.forEach((e,i) => e.index = i)
		images.forEach(e => e.areaIdxUsed = 0) // default is smallest
		images.forEach(e => e.textures = new Array(availableImageSizesByArea.length).fill(false))
		images.forEach(e => e.getPath = function(areaIdx = this.areaIdxUsed) {
			return "images/area"+availableImageSizesByArea[areaIdx]+"/"+this.file
		})
		images.forEach(e => e.date = e.date ? new Date(e.date) : undefined)
		
		images.sort((a,b) => {
			// compare by date, fall back to compare by name if no date available
			if (!a.date || !b.date)
				return a.file < b.file ? -1 : 1
			return a.date < b.date ? -1 : 1
		})
		
		infoBox = document.querySelector("#detailedInfo")
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
			
			for (let varr in parameters)
				initSlider(varr)
		})
		
	})
}

function initSlider(varr) {
	var ul = document.getElementById("controls")
	var li = ul.appendChild(document.createElement("li"))
	var slider = li.appendChild(document.createElement("input"))
	var label = li.appendChild(document.createElement("label"))
	label.setAttribute("for", varr)
	slider.setAttribute("id", varr)
	slider.setAttribute("type", "range")
	slider.setAttribute("min", min[varr])
	slider.setAttribute("max", max[varr])
	slider.setAttribute("step", step[varr])
	slider.value = window[varr]
	slider.setLabel = () => label.innerHTML = window[varr].toFixed(2)+" "+description[varr]
	slider.setLabel()
	slider.oninput = function(e) {
		window[varr] = Number(this.value)
		slider.setLabel()
		updateImages()
	}
}

function updateSlider(s) {
	var slider = document.querySelector("#"+s)
	slider.value = window[s]
	slider.setLabel()
}

function saveParameters() {
	if (localStorage)
		for (let varr in parameters)
			localStorage.setItem(varr, window[varr])
}

function resetParameters() {
	if (localStorage)
		localStorage.clear()
	for (let varr in parameters) {
		let [defaultValue, , , ] = parameters[varr]
		window[varr] = defaultValue
		updateSlider(varr)
	}
	updateImages()
}

function exportParameters() {
	var dl = {}
	for (let varr in parameters)
		dl[varr] = window[varr]
	window.open("data:application/json," + encodeURIComponent(JSON.stringify(dl)), "customParameters.json")
}

// synchronise xhr onload for all files
function withLoadedJSONfiles(fileNamesArray, callback) {
	var result = new Array(fileNamesArray.length).fill(false)
	
	fileNamesArray.forEach(function (e, i) {
		var xhr = new XMLHttpRequest()
		xhr.open("GET", e)
		xhr.onload = function() {
			if (this.status === 404) { // file not found
				console.log(e+" not found.")
				result[i] = null
			} else {
				console.assert(this.status === 200)
				result[i] = JSON.parse(xhr.responseText)
			}
			if (result.every(e => e !== false))
				callback(result)
		}
		xhr.send()
	})
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
		let dt = Date.now() - transition.start
		let progress = dt / transition.durationMS
		if (progress > 1) {
			progress = 1
			transition = false
		}
		
		let start = image.transitionStart
		let end = image
		
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
	
	// treat center image
	if (r < rStart) {
		let rampFrom0up = 1 - r/rStart
		exponent += centerImageScaleExponentIncrease * rampFrom0up
	}
	
	// scale is roughly distributed around 1
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
	zoom(wheelMovement)
	updateImages()
}

function zoom(sign) {
	if ((sign > 0 && powerScale < max.powerScale) || (sign < 0 && min.powerScale < powerScale)) {
		rStart          += sign * rStartGrowth
		rEnd            += sign * rEndGrowth
		scaleStart      += sign * scaleStartGrowth
		scaleEnd        += sign * scaleEndGrowth
		powerSimilarity += sign * powerSimilarityGrowth
		powerScale      += sign * powerScaleGrowth
		
		for (let varr in parameters) {
			// enforce bounds
			window[varr] = Math.max(min[varr], Math.min(window[varr], max[varr]))
			updateSlider(varr)
		}
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
	currentAlpha += 1/images.length*(τ-wedgeAngle)
	
	sprite.interactive = true
	// turns pointer to hand on mouseover
	//sprite.buttonMode = true
	
	sprite.on("mousedown", function(e) {
		if (image === centeredImage) {
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
}

function addToInfoBox(string) {
	var li = infoBox.appendChild(document.createElement("li"))
	li.appendChild(document.createTextNode(string))
}

function updateImages(newCenter = centeredImage) {
	centeredImage = newCenter
	
	while (infoBox.firstChild)
		infoBox.removeChild(infoBox.firstChild)
	for (key in centeredImage.meta)
		if (centeredImage.meta[key] !== undefined)
			addToInfoBox(centeredImage.meta[key])
	
	startTransition()
	images.forEach(img => {
		var similarity = centeredImage.similarity[img.index]
		similarity = Math.pow(similarity, powerSimilarity)
		
		img.r = linearInterpolation(rStart, (1-similarity), rEnd)
		img.scale = linearInterpolation(scaleStart, similarity, scaleEnd)
	})
	centeredImage.r = 0
	moveToFront(centeredImage.sprite)
}

function renderLoop() {
	images.forEach(img => positionImage(w, h, img))
	pixiRenderer.render(stage)
	requestAnimationFrame(renderLoop)
}


init()
