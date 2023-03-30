// TODO:

// pending white color is white - therefore unclear

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

function fadeColor(hexColor, fadeAmount) {
  // convert hex color string to RGB values
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);

  // calculate new RGB values with fade amount
  const newRed = Math.floor(red + (255 - red) * fadeAmount);
  const newGreen = Math.floor(green + (255 - green) * fadeAmount);
  const newBlue = Math.floor(blue + (255 - blue) * fadeAmount);

  // convert new RGB values back to hex color string
  const newHexColor = `#${newRed.toString(16)}${newGreen.toString(16)}${newBlue.toString(16)}`;

  return newHexColor;
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
	
	this.canvas         = "UNSET CANVAS";
	this.cellSize       = 10;
	this.lastHover      = null;
	this.leftButtonDown = false;
	this.mouseCoords    = [0,0];

	this.moveLeft  = false;

	this.moveUp    = false;
	this.moveright = false;
	this.moveDown  = false;
	
	this.scale              = 1;
	this.center             = [0,0];
	this.translate          = [0,0];
	this.unscaled_translate = [0,0];

	this.queue        = [];
	this.currentTiles = {};
	this.renderQueue  = [];
	
	return this;
    }


    //
    // this function runs the FIRST time that Saito is initialized. here we add the 
    // publickey to which our Graffiti transactions are sent to our keychain so that 
    // peers will send us blocks containing updates.
    //
    installModule(app) {
      //
      // add the publickey for the graffiti module to our keychain as a "watched" address
      //
      this.app.keychain.addKey(this.appPubKey, {watched: true});
    }

    //
    // when peers connect to each other, they share an array of "services" they support.
    // implementing this function will allow us to know which peers are running which 
    // version of the graffiti module when they connect.
    //
    returnServices() {
      return [{ service: "graffiti", appPubKey: this.appPubKey}];
    }

    //
    // this function runs whenever we connect to a peer. in this case, if the peer is
    // running a copy of THIS Graffiti application with THIS Graffiti publickey, we want
    // to query it for the current state of the tileset.
    // 
    onPeerServiceUp(app, peer, service) {
      if (service.service === "graffiti") {
	if (service.appPubKey === this.appPubKey) {
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
      }
    }



    //
    //
    //
    initializeHTML(app) {
	console.log("initializing html...");

	// (cellSize (in pixels), cellsWide, cellsTall);
	// cellSize should be at least 40 to prevent blur
	this.initializeCanvas(10, 400, 400);
	this.app.network.propagateKeylist();
	// This is how the browser gets up to date canvas from node on startup
	for (const [key, value] of Object.entries(this.currentTiles)) {
	    console.log(key, value);
	    this.drawTile(key["coords"], value, app);
	}
	for (let i = 1; i < 10; i++) {
	    setTimeout(function timer() {
		let mymod = app.modules.returnModule("Graffiti");
		console.log(mymod.moveUp);
	    }, i * 3000);
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

	// for every tile in the queue from the tx
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
		mymod.drawTile(coords, color, app);
		//
		if (mymod.lastHover) {
		    if (String(mymod.lastHover["coords"]) == String(coords)) {
			console.log("changing lastHover");
			mymod.lastHover["color"] = color;
		    }
		}
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
// gpt optimized
	
	const { translate, unscaled_translate, center, scale, canvas } = this;
	translate[0] = unscaled_translate[0] + center[0] / scale;
	translate[1] = unscaled_translate[1] + center[1] / scale;

	const x_str = `${translate[0]}px,`;
	const y_str = `${translate[1]}px,`;

	canvas.style.webkitTransform = `scale(${scale}) translate3d(${x_str}${y_str}0px)`;

/*
// handwritten
	this.translate[0] = this.unscaled_translate[0] + (this.center[0] / this.scale);
	this.translate[1] = this.unscaled_translate[1] + (this.center[1] / this.scale);

	let x_str = String(this.translate[0]) + "px,";
	let y_str = String(this.translate[1]) + "px)";

	let t   = "translate3d(" + x_str + y_str;
	let s = "scale(" + this.scale + ") " + t;

	this.canvas.style.transform = s;
*/
    }
    
    attachEvents(app, mod) {

	let mymod = app.modules.returnModule("Graffiti");
  	let canvas = mymod.canvas;
	let ctx = canvas.getContext('2d');
//	const width = canvas.width;
//	const height = canvas.height;

	const zoom_speed = 1.1;

	document.addEventListener("resize", function (e) {
	    console.log("resizing");
	    let x_shift = window.innerWidth  - mymod.canvas.width;
	    let y_shift = window.innerHeight - mymod.canvas.height;
	    mymod.center = [x_shift / 2, y_shift / 2];
	});

	document.addEventListener("wheel", function (e) {
	    let x = e.clientX - mymod.center[0]
	    let y = e.clientY - mymod.center[1]
	    
	    if (e.deltaY < 0) {
		mymod.scale *= zoom_speed;
	    }
	    else {
		mymod.scale /= zoom_speed;
	    }

	    mymod.transformElement(x, y);
	    mymod.handleBrush(mymod.mouseCoords, app);
	    
	});
	let shift = 40;
	let dirKeys = {"s":0, // up
		       "d":1, // right
		       "x":2, // down 
		       "a":3};// left

	function l(m) {console.log(m)};
	document.addEventListener("keydown", (e) => {
	    switch(dirKeys[e.key]) {
	    case 0:
		mymod.unscaled_translate[1] += shift;
		mymod.moveUp = true;
		break;
	    case 2:
		mymod.unscaled_translate[1] -= shift;
		mymod.moveDown = true;
		break;
	    case 3:
		mymod.unscaled_translate[0] += shift;
		mymod.moveLeft = true;
		break;
	    case 1:
		mymod.unscaled_translate[0] -= shift;
		mymod.moveRight = true;
	break;
	    }
	    mymod.transformElement();
	    mymod.handleBrush(mymod.mouseCoords, app);
	});

	document.addEventListener("keyup", (e) => {
	    switch(dirKeys[e.key]) {
	    case 0:
		mymod.moveUp = false;
		break;
	    case 2:
		mymod.moveDown = false
		break;
	    case 3:
		mymod.moveLeft = false;
		break;
	    case 1:
		mymod.moveRight = false;
	break;
	    }
	    mymod.transformElement();
	    mymod.handleBrush(mymod.mouseCoords, app);
	});

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
	canvas.onmouseover = (e) => {
	    //
	    // save the color of the cell the cursor hovers over
	    // as it enters the canvas
	    //
//	    let coords = getTileCoords(mymod.canvas, e, mymod.tileSize, mymod.scale)
	    let coords = getTileCoords(mymod.canvas,
				       [e.clientX, e.clientY],
				       mymod.tileSize, mymod.scale)
	    let color  = document.getElementById("favcolor").value;
	    mymod.lastHover = {'coords': coords,
			       'color' : mymod.getColor(coords)
			      }
	    
	    // then draw the preview
	    // this.handleBrush will use this.lastHover to revert
	    // this preview drawing once cursor moves inside of a new cell
	    //
	    mymod.drawTile(coords, color, app);
	    
	    
	}

	//
	// Cleanly stop showing previews when cursor leaves canvas
	//
	canvas.onmouseout = (e) => {
	    //
	    // restore the cell in lastHover then set it to null
	    // since cursor is leaving the canvas
	    //
	    mymod.drawTile(mymod.lastHover.coords, mymod.lastHover.color, app);
	    mymod.lastHover = null;
	}

	//// Handle mouse movement and clicking within the canvas.
	/// Handles both drawing previews + queuing and sending cell paint actions.
	// Paints on click and drag.
	//
	canvas.onmousemove = (e) => {
	    let coords = [e.clientX, e.clientY];
	    this.handleBrush(coords, app);
	    this.mouseCoords = coords;
	}
	//
	// paints on stationary click
	//
	canvas.onclick = (e) => {
	    this.handleBrush([e.clientX, e.clientY], app, true);
	}

    }
    
    initializeCanvas(tileSize, tilesWide, tilesTall) {
	let canv_div = document.getElementById("canvas-container")

	canv_div.innerHTML += `<canvas id="cnv"></canvas`;
	this.canvas = document.getElementById("cnv")
	
	console.log("canvas ", this.canvas);

	this.tileSize = tileSize;
	
	this.canvas.width = tileSize * tilesWide;
	this.canvas.height = tileSize * tilesTall;

	let x_shift = window.innerWidth  - this.canvas.width;
	let y_shift = window.innerHeight - this.canvas.height;

	this.center             = [x_shift / 2, y_shift / 2];
	this.translate          = [0,0];
	this.unscaled_translate = [0,0];

//	this.unscaled_translate = [this.canvas.offsetLeft, this.canvas.offsetTop];
	
	this.transformElement(this.canvas, this.scale, this.translate[0], this.translate[1]);

	let ctx = this.canvas.getContext('2d');
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

//      grid has bug -- needs to be redrawn after cell is drawn or it dissapears
//	this.drawGrid(tileSize, canvas.width, canvas.height);
    }
    
    // dont use grid
    drawGrid(size, width, height) {
	let canvas = this.canvas;
	let ctx = canvas.getContext('2d');

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

    drawHourGlass(coords) {
	let canvas = this.canvas;
	let ctx = canvas.getContext('2d');

	let pad = 10;
	let x = coords[0] + pad;
	let y = coords[1] + pad;
	let size = this.tileSize - pad;

	ctx.lineWidth = 2;
	ctx.strokeStyle = "black";
	
//	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + size, y);
	ctx.lineTo(x, y + size);
	ctx.lineTo(x + size, y + size);
	ctx.lineTo(x, y);
	ctx.stroke();

    }

    setLastHover(coords, color) {
	this.lastHover = {'coords': coords,
			   'color' : mymod.getColor(coords)
			 }
    }

    queueTile(event, app) {
	// TODO: this recalculates a lot of values it doesn't need to
	// pass them as arguments instead, like coords to the tile 
	
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
	let semiColor = fadeColor(color, 0.5);

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

    drawTile(coords, color, app) {
	let mymod = app.modules.returnModule("Graffiti");
	let ctx = this.canvas.getContext('2d');

	// whiteout cell
//	ctx.fillStyle = "#ffffff";
//	ctx.fillRect(coords[0], coords[1], this.tileSize, this.tileSize);
	// then draw color in
	ctx.fillStyle = color;
	ctx.fillRect(coords[0], coords[1], this.tileSize, this.tileSize);
    }
    
    new_drawTile(coords, color, app) {

	// whiteout cell
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(coords[0], coords[1], this.tileSize, this.tileSize);
	// then draw color in
	ctx.fillStyle = color;
	ctx.fillRect(coords[0], coords[1], this.tileSize, this.tileSize);
    }
    
    //
    // draws preview on cursor hover + builds and sends user paint queues
    //
//    handleBrush(event, app, tapped=false) {
    handleBrush(coords, app, tapped=false) {
	let mymod = app.modules.returnModule("Graffiti");
	// get coordinates of cursor relative to canvas
	//	let coords = getTileCoords(mymod.canvas, event, mymod.tileSize, mymod.scale)


	coords = getTileCoords(mymod.canvas,
			       [coords[0], coords[1]],
			       mymod.tileSize, mymod.scale)

	let color  = document.getElementById("favcolor").value;
	let newTile = false;
	let newColor = false;

	// check to see if non-null lastHover shrares color or position with current
	// cell cursor is moving within
	//
	// if lastHover is null or same color and position this function does nothing
	//
	if (mymod.lastHover) {
	    newTile = JSON.stringify(coords) != JSON.stringify(mymod.lastHover['coords']);
	    newColor = color.slice(0, 7) != mymod.lastHover['color'].slice(0, 7);
	}
	else { return; }

	let clicked = mymod.leftButtonDown || tapped;
	
	//
	// if cursor over new tile, or user is painting currently hovered cell
	//
	if (newTile || (newColor && clicked) ) {

	    // save the old color for later before drawing over it
	    let ctx = mymod.canvas.getContext('2d');
	    let oldColor = mymod.getColor(coords);

	    // if clicked, then paint data will be sent to chain
	    //
	    if (newColor && clicked) {
		// oldColor is now the painted color
		// function queues up cell position and color data
		oldColor = mymod.queueTile(event, app);
		
		// if mouse was tapped once instead of dragged
		//
		if (tapped) {
		    // then send the queue (single coord+color combo)
		    mymod.sendQueueTx(app);
		}
		// 
		// otherwise the queue is sent when mouse is dragged -
		// this is done inside the document.onmouseup event
	    }

	    // if no click, then don't paint, but draw the preview
	    // and restore the true color of the last cell hovered over
	    //
	    else {
		// draw preview over cnurrently hovered cell
		mymod.drawTile(coords, color, app);
		// replace previous hovered cell's true color
		// mymod.drawTile(mymod.lastHover['coords'], mymod.lastHover['color']);
	    }
	    
	    // replace previous hovered cell's true color
	    if (newTile) {
		mymod.drawTile(mymod.lastHover['coords'], mymod.lastHover['color'], app);
	    }
	    
	    // Finally, set currently hovered tile as lastHover

	    mymod.lastHover = {'coords': coords,
			       'color' : oldColor
			      }
	}
    }

}

module.exports = Graffiti;

