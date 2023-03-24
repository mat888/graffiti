// TODO:

// pending white color is white - therefore unclear

// moving image left,right,up,down while holding paint button down may be glitchy

// don't use keydown to check if heys are held, do it manually

// remove any subpixel scaling on zoom ? 

var saito = require('../../lib/saito/saito');
var ModTemplate = require('../../lib/templates/modtemplate');
const GraffitiAppspaceMain = require('./lib/appspace/main');


// These two functions read canvas pixel data and return a HEX color
// not necessary anymore but leaving for now just in case
function getPixel(context, x, y) {
    var p = context.getImageData(x+5, y+5, 1, 1).data;
    var hex = "#" + ("000000" + rgbToHex(p[0], p[1], p[2])).slice(-6);  
    return hex;
}
function rgbToHex(r, g, b) {
    if (r > 255 || g > 255 || b > 255)
        throw "Invalid color component";
    return ((r << 16) | (g << 8) | b).toString(16);
}

// takes hex color
function tooWhite(color) {
    
}



// given any point on the canvas, find the coordinates of
// the tile those coordinates reside within
function getTileCoords(canvas, event, cellSize, zoom) {
    let rect   = canvas.getBoundingClientRect();
//    let coords = [(event.clientX - rect.left) / zoom,
//		  (event.clientY - rect.top)  / zoom]
    // transform real numbered coords into top left corner of cell those coords reside in
    let coords = [(event[0] - rect.left) / zoom,
		  (event[1] - rect.top ) / zoom];
    let cell_sz = cellSize * zoom;
    coords = coords.map(t => Math.floor(t));
    coords = coords.map(t => t - (t % cellSize));
    return coords;
    
//    coords = coords.map(t => t / zoom);
//    coords = coords.map(t => Math.floor(t));

//    return coords;
    }

class Graffiti extends ModTemplate {

    constructor(app) {
	super(app);
	super.initialize(app);
	
	this.app         = app;
	this.name        = "Graffiti";
	this.appname     = "Graffiti";
	this.appPubKey   = "zEC6dxU9P1LFsHpc3BANqaPdRu4njmqbouCqgRQwFa6J"
	this.description = "Graffiti description"
	this.categories  = "Utilities Core";
	this.icon	 = "fas fa-code";
	
	this.canvas         = null;
	this.ctx            = null;
	this.cellSize       = 10;
	this.leftButtonDown = false;
	this.mouseCoords    = [0,0];

	this.moveLeft  = false;
	this.moveUp    = false;
	this.moveright = false;
	this.moveDown  = false;
	
	this.zoom        = 30;
	this.offset      = [0,0];

	this.queue        = [];
	this.currentTiles = {};
	this.reDrawing = false;

	this.renderQueue  = [];
	
	this.description = "A debug configuration dump for Saito";
	this.categories  = "Dev Utilities";

	
	app.keys.addKey( this.appPubKey , {watched: true});

	return this;
    }

    initializeHTML(app) {
	console.log("initializing html...");

	this.initializeCanvas(1200, 1200);

	// This is how the browser gets up to date canvas from node on startup
	for (const [key, value] of Object.entries(this.currentTiles)) {
	    console.log(key, value);
	    this.drawTile(key["coords"], value, app);
	}
	for (var i = 1; i < 2; i++) {
	    setTimeout(function timer() {
		let mymod = app.modules.returnModule("Graffiti");
		console.log(mymod.moveUp);
	    }, i * 3000);
	}
	

	//////////////////////////////////////////////////////////////////////////////
	// HTML EVENTS ///////////////////////////////////////////////////////////////

	let mymod = app.modules.returnModule("Graffiti");
	
	// RESIZE EVENT	
	window.onresize = function resize() {
	    
	    mymod.canvas.width = Math.floor(window.innerWidth * 0.5);
	    mymod.canvas.height = Math.floor(window.innerHeight * 0.5);
	    
	    mymod.reDrawing = true;
	}
	
	// MOUSEMOVE EVENT
	this.canvas.addEventListener("mousemove", function (e) {
	    mymod.mouseCoords = [e.clientX - mymod.canvas.offsetLeft,
				 e.clientY - mymod.canvas.offsetTop]
	});

	// CLICK EVENT
	this.canvas.addEventListener("click", function (e) {
	    var coords = mymod.get_tile_corner(mymod.mouseCoords[0], mymod.mouseCoords[1]);

	    coords[0] = coords[0] + (mymod.offset[0] * mymod.zoom);
	    coords[1] = coords[1] + (mymod.offset[1] * mymod.zoom);
	    var tile_coords = coords.map(t => Math.floor(t / mymod.zoom));


	    var color =  "#00ff00";
	    mymod.currentTiles[tile_coords] = color;
	    mymod.renderQueue.push(tile_coords);
	    console.log("CLICK EVENT COORDS: ", tile_coords);
	});

	// SCROLL (ZOOM) EVENT
	document.addEventListener("wheel", function (e) {


	    /*
	      Calculate how many tiles the canvas is rendering in x and y direction.

	      For example, when the zoom=1, the canvas is rendering 1 tile for
	      every pixel. So tilesRenderedX = canvas.width

	      When zoom=5, the canvas is rendering 1 tile for every five pixels.
	      tilesRenderedX = canvas.width / zoom

	      If the canvas is 100 pixels wide and the zoom is 10, the canvas
	      will render 10 tiles in the x direction.

	      The canvas always renders with the top left corner as the origin.
	      When zoom is 10, the top left pixels grows nine pixels outwards
	      going to the right and down.

	      This has the effect of zooming into the top left corner.

	      To zoom into the center, offset values must be adjusted when zoom changes.

	      The goal is to make the centermost tile on the canvas before the zoom the
	      centermost tile after the zoom.

	      Examples:
	      When the zoom is 1 and the width is 100, the centerX value equals 50.

	      Normally when zooming to zoom=2, the canvas will render x tiles 0 to 50 twice as wide.

	      The desired effect is to render the x tiles 25 to 75 twice as wide.

	      This is an x canvas offset of 25.

	      ---

	      What if zoom=1 and the x offset is already 30, such that zoom=1 renders 30,130?

	      When zoom=2, canvas will render x from 30 to 80 but to center it would require 80 to be the
	      center. 80 as the center with 50 tiles rendered means tiles 55 to 105 are rendered.

	      Again, adding an x offset of 25 centers the new zoom.

	      25 is coming from the fact that a canvas pixel width of 100, with tiles that are 2 pixels wide
	      means the canvas will render 50 tiles... 

	      When at zoom=1, it renders 100 tiles, and naively zooming will restrict that to the first 50,
	      but the desired result is not the first 50, but the middle 50. This middle 50 is relative to
	      what the middle 50 were at zoom=1, with any preexisting offset.

	      Since the tile width of the canvas at zoom=2 is 50, the center is at 25. Zooming from 1 to 2
	      will halve the tiles rendered to 50 - by pushing them to the right by half this value, 25, 
	      it will center them.

	      --

	      What if zoom=1 and is increasing to 3? The canvas will render the first 33 tiles.
	      At zoom 1, there were 100 tiles, and the middle tile was 50. The desire at zoom 3
	      is to render 33 tiles centered around tile 50 at zoom 1, so that is 50-16.2 to 50+16.5

	      More generally, it is the center tile at prevZoomTiles=(width/oldZoom/2)=(100/2)=50
	      and subtracting from that prevZoom - newZoomTiles/2 = offsetX
	      where newZoomTiles = width/newZoom/2 = (100/3)/2

	      --

	      If zoom=2 and is going to 3, then the x offset is already 25, and 50 tiles are rendered.
	      At zoom=3, 33 tiles will be rendered, so 16.5 tiles left and right of 50.

	      At zoom=3 with no offset adjustment, it will render 33 tiles starting from 25, so 25 to 58.
	      The desired 33 tiles to be rendered are centered around 50, so 33.5 to 66.5

	      Since the offset is already 25 and needs to be 33.5 (33.5 - 25 = 8.5) must be added to offset.

	      8.5 = width/2 - width/3/2 - width/2/2

	     */

	    let prevZoomCenterTileX = (mymod.canvas.width/mymod.zoom/2);
	    let prevZoomCenterTileY = (mymod.canvas.height/mymod.zoom/2);
	    
	    if (e.deltaY < 0) {
		mymod.zoom++;
	    }
	    else if (mymod.zoom == 1 && e.deltaY > 0) { return; }
	    else {
		mymod.zoom--;
	    }

	    let newZoomCenterTileX = (mymod.canvas.width/mymod.zoom/2);
	    let newZoomCenterTileY = (mymod.canvas.height/mymod.zoom/2);
	    console.log(prevZoomCenterTileX, newZoomCenterTileX);
	    
	    mymod.offset[0] += Math.round(prevZoomCenterTileX - newZoomCenterTileX);
	    mymod.offset[1] += Math.round(prevZoomCenterTileY - newZoomCenterTileY);
	    
	    console.log("offset: ", mymod.offset);
	    mymod.reDrawing = true;;
	});

	
	// CANVAS SHIFT EVENT
  	let canvas = mymod.canvas;
	let ctx = mymod.ctx;

	let shift = 1;
	let dirKeys = {"s":0, // up
		       "d":1, // right
		       "x":2, // down 
		       "a":3};// left

	document.addEventListener("keydown", (e) => {
	    switch(dirKeys[e.key]) {
	    case 0:
		mymod.offset[1] -= shift;
		mymod.moveUp = true;
		mymod.reDrawing = true;
		break;
	    case 2:
		mymod.offset[1] += shift;
		mymod.moveDown = true;
		mymod.reDrawing = true;
		break;
	    case 3:
		mymod.offset[0] -= shift;
		mymod.moveLeft = true;
		mymod.reDrawing = true;
		break;
	    case 1:
		mymod.offset[0] += shift;
		mymod.moveRight = true;
		mymod.reDrawing = true;
		break;
	    }

	});

	document.addEventListener("keyup", (e) => {
	    switch(dirKeys[e.key]) {
	    case 0:
		console.log("key up: ", e.key, dirKeys[e.key]);
		mymod.moveUp = false;
		break;
	    case 2:
		console.log("key up: ", e.key, dirKeys[e.key]);
		mymod.moveDown = false
		break;
	    case 3:
		console.log("key up: ", e.key, dirKeys[e.key]);
		mymod.moveLeft = false;
		break;
	    case 1:
		console.log("key up: ", e.key, dirKeys[e.key]);
		mymod.moveRight = false;
	break;
	    }

	});

	// END HTML EVENTS ////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	
	this.canvas_loop();
	
    }

    get_tile_corner(x, y) {
	var x_t = Math.floor((x - this.offset[0]) / this.zoom);
	var y_t = Math.floor((y - this.offset[1]) / this.zoom);

//	return [x_t, y_t];

	var coords = [x, y];
	coords = coords.map(t => t - (t % this.zoom));

	return coords;
    }
    
    canvas_loop() {

	// function which takes:
	//  scale
	//  offset
	//  position

	// and repaints within a constant sized canvas the cells


	// this should be done outside this loop function


	// if entire canvas must be redrawn, clear it first
	if (this.reDrawing) {
	    this.reDraw();
	}

	// if renderQueue empty, do nothing, move on to next
	// loop iteration
	if (this.renderQueue.length == 0) {
//	    this.reDrawing = false;
	    return requestAnimationFrame(()=>this.canvas_loop());
	}
	console.log("drawing");


	for (var i = 0; i < this.renderQueue.length; i++) {
//	    var coords = this.renderQueue[i][0].map(t => t * this.zoom);
	    //	    var color =  this.renderQueue[i][1];

	    // coords is where the canvas will be painted
	    // but the "real" coords stay unmodified in this.renderQueue
//	    var coords = this.renderQueue[i].map(t => t * this.zoom);
	    var coords = this.renderQueue[i];
	    if (this.reDrawing == false) {
		console.log("LOOP COORDS: ", coords);
		console.log("COLOR: ", this.currentTiles[coords]);
	    }
	    if (this.currentTiles[this.renderQueue[i]] == null) {continue;}
	    
	    var color =  this.currentTiles[coords];
	    this.ctx.fillStyle = color;
	    this.ctx.fillRect((coords[0] - this.offset[0]) * this.zoom,
			      (coords[1] - this.offset[1]) * this.zoom,
			      this.zoom, this.zoom);

//	    console.log("this.ctx.fillRect(",coords[0] * this.zoom, coords[1] * this.zoom, this.zoom, this.zoom, ");");
	    
	    //this.ctx.fillStyle = color;
	    //this.ctx.fillRect(coords[0], coords[1], this.zoom, this.zoom);
	    /*
	    console.log("DRAWING: ----------------------");
	    console.log("(x, y) : ", coords);
	    console.log("color  : ", color);
	    console.log("Size   : ", this.zoom);
	    */
	}

	
	this.reDrawing = false;
	this.renderQueue = [];

	requestAnimationFrame(()=>this.canvas_loop());
    }

    // 
    reDraw() {
	console.log("reDrawing");

	let ctx = this.ctx;
//	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	
	ctx.fillStyle = "#ffffff"
	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	this.renderQueue = [];

	// TODO
	// width and height are computed for all redraw events including:
	// * zooming in and out
	// * resizing window
	// * shifting canvas coords
	//  but it only needs to be computed when resizing window (or cnv size changes)
	let width  = Math.ceil(this.canvas.width  / this.zoom);
	let height = Math.ceil(this.canvas.height / this.zoom);
	//
	
	for (var i = 0; i < width; i++) {
	    for (var j = 0; j < height; j++) {
		this.renderQueue.push([i + this.offset[0],// - Math.floor(width / 2),
				       j + this.offset[1]]// - Math.floor(height/ 2]
				     );
	    }
	}

	/*
	console.log("Width: ", width);
	console.log("Height: ", height);
	console.log("zoom: ", this.zoom);
	console.log("renderQueue: ", this.renderQueue);
	console.log("currentTiles: ", this.currentTiles);
	*/
    }

    draw_tile(coords, color="#ffffff") {

	//
    }



    onPeerHandshakeComplete(app) {
	let mymod = app.modules.returnModule("Graffiti");
	let sql = `SELECT * FROM tiles;`;
	let color;
	let coords;
	this.sendPeerDatabaseRequestWithFilter("Graffiti", sql, (res) => {
	    console.log("fetching initial tiles values from full node");
            if (res.rows) {
		res.rows.map((row) => {
                    //
		    // each row here
                    //
		    coords = JSON.parse(row["coords"]);
		    color  = row["color"];
		    mymod.drawTile(coords, color, app);
		    mymod.currentTiles[coords] = color;
		});
            }
	});
	if (mymod.lastHover) {
	    if (String(mymod.lastHover["coords"]) == String(coords)) {
		console.log("changing lastHover");
		mymod.lastHover["color"] = color;
	    }
	}
    }
    async onConfirmation(blk, tx, conf, app) {
	if (conf > 0) { return; }
	//	this.receiveQueueTx(tx);
	
	let txmsg = tx.returnMessage();
	let queue = txmsg.tiles;
	let mymod = app.modules.returnModule("Graffiti");
	
	// TODO
	// check if coords and color are valid before saving or drawing
	for (let i = 0; i < queue.length; i++) {
	    let coords = queue[i][0];
	    let color  = queue[i][1];
	    
	    // update tiles dictionary
	    mymod.currentTiles[String(coords)] = color;
	    
	    // full node
	    if (app.BROWSER == 0) {
		// sql handling
		this.receiveQueueTx(queue[i]);
	    }
	    // lite node
	    else {
		console.log("about to draw in browser");

		// only do this (queue to render) if tile is in frame
		mymod.drawTile(coords, color, app);
		//
	    }
	}
    }

    //
    // send queue of tiles to be drawn on-chain
    //
    sendQueueTx(app) {
	
	let newtx = app.wallet.createUnsignedTransaction(this.appPubKey);
	newtx.msg.module = "Graffiti";
	newtx.msg.tiles = this.queue;
	newtx = app.wallet.signTransaction(newtx);
	app.network.propagateTransaction(newtx);

	this.queue = [];
    }

    //
    // and receive it !
    //
    // this will run on the server and on any lite-clients that are also listening
    // for the graffiti transactions. but the lite-clients probably do not have a 
    // database running and so will be running "empty" functions when they try to
    // insert into DB.
    //
    async receiveQueueTx(tile) {
	let coords = JSON.stringify(tile[0]);
	let color  = tile[1];
	//
	// insert into database | overwrite existing tiles
	//
	let sql = `REPLACE INTO tiles (
          coords,
          color
        ) VALUES (
          $coords,
          $color
        )`;
        let params = {
	    $coords: coords,
            $color: color,
        };
        await this.app.storage.executeDatabase(sql, params, "graffiti");
	
    }

    transformElement() {
	
	this.translate[0] = this.unscaled_translate[0] + (this.center[0] / this.scale);
	this.translate[1] = this.unscaled_translate[1] + (this.center[1] / this.scale);

	let x_str = String(this.translate[0]) + "px,";
	let y_str = String(this.translate[1]) + "px)";

	let t   = "translate(" + x_str + y_str;
	let s = "scale(" + this.scale + ") " + t;

	this.canvas.style.transform = s;
    }
    
    attachEvents(app, mod) {
/*
	//
	// Handle leftButtonDown flag
	//
	document.onmousedown = (e) => {
	    if (e.which === 1) {mymod.leftButtonDown = true}
	}

	document.onmouseup = (e) => {
	    // send queue generated by dragging mouse
	    mymod.sendQueueTx(app);
	    
	    if (e.which === 1) {mymod.leftButtonDown = false}
	}
	//

	//
	// initiate color preview when hovering over cell
	//
//	canvas.onmouseover = (e) => {	}

	//
	// Cleanly stop showing previews when cursor leaves canvas
	//
//	canvas.onmouseout = (e) => {	}

	//// Handle mouse movement and clicking within the canvas.
	/// Handles both drawing previews + queuing and sending cell paint actions.
	// Paints on click and drag.
	//
//	canvas.onmousemove = (e) => {	}
	//
	// paints on stationary click
	//
//	canvas.onclick = (e) => {	}
*/
    }
    
    initializeCanvas(tilesWide, tilesTall) {
	let canv_div = document.getElementById("canvas-container")

	canv_div.innerHTML += `<canvas id="cnv"></canvas`;
	this.canvas = document.getElementById("cnv")
	
	console.log("canvas ", this.canvas);
	
	this.canvas.width  = Math.floor(window.innerWidth  * (0.5));
	this.canvas.height = Math.floor(window.innerHeight * (0.5));

	this.shift = [0, 0];
	this.zoom = 1;
	
	let ctx = this.canvas.getContext('2d', {alpha: false});
	this.ctx = ctx;
	
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

//      grid has bug -- needs to be redrawn after cell is drawn or it dissapears
//	this.drawGrid(tileSize, canvas.width, canvas.height);
    }
    
    // dont use grid
    drawGrid(size, width, height) {
	let canvas = this.canvas;
	let ctx = this.ctx;

	for (let i = 0; i <= width; i += size) {
	    ctx.moveTo(i, 0);
	    ctx.lineTo(i, height);
	    ctx.lineWidth = 1;
	    ctx.stroke();
	}

	for (let j = 0; j <= height; j += size) {
	    ctx.moveTo(0, j);
	    ctx.lineTo(width, j);
	    ctx.lineWidth = 1;
	    ctx.stroke();
	}
    }


    queueTile(event, app) {
	// get coordinates of mouse click relative to canvas
	let mymod = app.modules.returnModule("Graffiti");
	let rect = mymod.canvas.getBoundingClientRect();
//	let coords = [event.clientX - rect.left,
//		      event.clientY - rect.top]
//	let coords = getTileCoords(mymod.canvas, event, mymod.cellSize, mymod.scale);
	let coords = getTileCoords(mymod.canvas,
				   [event.clientX, event.clientY],
				   mymod.cellSize, mymod.scale);
	// transform real numbered coords into top left corner of cell those coords reside in
	coords = coords.map(t => Math.floor(t));
	coords = coords.map(t => t - (t % mymod.tileSize));
	
	// get color then pre-draw cell
	let color = document.getElementById("favcolor").value;

	// preview color is washed out
	let semiColor = color + "80"

	// if color is too white
	if (color[1] == "f" && color[3] == "f" && color[5] == "f") {
	    // make the preview darker than intended color
	    console.log("too white!")
	    semiColor = color + "b0";
	}

	mymod.drawTile(coords, semiColor, app);
	mymod.currentTiles[String(coords)] = semiColor;

//	mymod.drawHourGlass(coords);

	this.queue.push([coords, color]);
	return semiColor;
    }

    getColor(coords) {
	let color = this.currentTiles[String(coords)];
	if (color) {
	    return color;
	}
	else { // return white
	    return "#FFFFFF";
	}
    }


}

module.exports = Graffiti;

//let c = document.getElementById('cnv').getContext('2d');
