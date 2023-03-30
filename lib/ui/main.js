const GraffitiUiTemplate = require('./main.template');

class GraffitiUi {

  constructor(app, mod, container="") {

    this.app = app;
    this.mod = mod;
    this.container = container;

    this.canvas         = "UNSET CANVAS";
    this.cellSize       = 10;
    this.lastHover      = null;
    this.leftButtonDown = false;
    this.mouseCoords    = [0,0];

    this.shift = 40;
    this.dirKeys = {"s":0, // up
                    "d":1, // right
                    "x":2, // down
                    "a":3};// left

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

  }

  //
  //
  //
  render() {

    if (document.querySelector(".graffiti-ui-container")) {
      this.app.browser.replaceElementBySelector(GraffitiUiTemplate(), ".graffiti-ui-container");
    } else {
      this.app.browser.addElementToSelector(GraffitiUiTemplate(), this.container);
    }
    this.attachEvents();

  }

  //
  //
  //
  attachEvents() {

    let ctx = canvas.getContext('2d');
    let zoom_speed = 1.1;

    document.addEventListener("resize", (e) => {
      console.log("resizing");
      let x_shift = window.innerWidth  - this.canvas.width;
      let y_shift = window.innerHeight - this.canvas.height;
      this.center = [x_shift / 2, y_shift / 2];
    });

    document.addEventListener("wheel", (e) => {
      let x = e.clientX - this.center[0]
      let y = e.clientY - this.center[1]
      if (e.deltaY < 0) { this.scale *= zoom_speed; } else { this.scale /= zoom_speed; }
      this.transformElement(x, y);
      this.handleBrush(this.mouseCoords, this.app);
    });

    document.addEventListener("keydown", (e) => {
      switch(dirKeys[e.key]) {
        case 0:
            this.unscaled_translate[1] += shift;
            this.moveUp = true;
            break;
        case 2:
            this.unscaled_translate[1] -= shift;
            this.moveDown = true;
            break;
        case 3:
            this.unscaled_translate[0] += shift;
            this.moveLeft = true;
            break;
        case 1:
            this.unscaled_translate[0] -= shift;
            this.moveRight = true;
        break;
      }
      this.transformElement();
      this.handleBrush(this.mouseCoords, app);
    });

    document.addEventListener("keyup", (e) => {
      switch(dirKeys[e.key]) {
        case 0:
            this.moveUp = false;
            break;
        case 2:
            this.moveDown = false
            break;
        case 3:
            this.moveLeft = false;
            break;
        case 1:
            this.moveRight = false;
        break;
      }
      this.transformElement();
      this.handleBrush(this.mouseCoords, app);
    });
  
    //
    // left mouse-button down
    //
    document.onmousedown = (e) => {
      if (e.which === 1) {this.leftButtonDown = true}
    }
    document.onmouseup = (e) => {
      // MAKE REQUEST TO UNDERLYING MODULE -- BLOCKCHAIN INVOKED
      this.mod.sendQueueTransaction(this.queue);
      if (e.which === 1) {this.leftButtonDown = false}; 
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
      let coords = getTileCoords(this.canvas, [e.clientX, e.clientY], this.tileSize, this.scale);
      let color  = document.getElementById("favcolor").value;
      this.lastHover = {'coords': coords, 'color' : this.getColor(coords)}

      // then draw the preview
      // this.handleBrush will use this.lastHover to revert
      // this preview drawing once cursor moves inside of a new cell
      //
      this.drawTile(coords, color, app);

    }

    //
    // Cleanly stop showing previews when cursor leaves canvas
    //
    canvas.onmouseout = (e) => {
      //
      // restore the cell in lastHover then set it to null
      // since cursor is leaving the canvas
      //
      this.drawTile(this.lastHover.coords, this.lastHover.color, this.app);
      this.lastHover = null;
    }

    // Handles both drawing previews + queuing and sending cell paint actions.
    // Paints on click and drag.
    //
    canvas.onmousemove = (e) => {
      let coords = [e.clientX, e.clientY];
      this.handleBrush(coords, this.app);
      this.mouseCoords = coords;
    }

    //
    // paints on stationary click
    //
    canvas.onclick = (e) => { this.handleBrush([e.clientX, e.clientY], this.app, true); }

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

    this.transformElement(this.canvas, this.scale, this.translate[0], this.translate[1]);

    let ctx = this.canvas.getContext('2d');
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

  }


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

    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x, y);
    ctx.stroke();

  }

  setLastHover(coords, color) {
    this.lastHover = {'coords': coords, 'color' : this.getColor(coords)}
  }

  drawTile(coords, color, app) {
    let ctx = this.canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(coords[0], coords[1], this.tileSize, this.tileSize);
  }

  handleBrush(coords, app, tapped=false) {

    coords = getTileCoords(this.canvas, [coords[0], coords[1]], this.tileSize, this.scale)
    let color  = document.getElementById("favcolor").value;
    let newTile = false;
    let newColor = false;

    //
    // check to see if non-null lastHover shrares color or position with current
    // cell cursor is moving within
    //
    // if lastHover is null or same color and position this function does nothing
    //
    if (this.lastHover) {
      newTile = JSON.stringify(coords) != JSON.stringify(this.lastHover['coords']);
      newColor = color.slice(0, 7) != this.lastHover['color'].slice(0, 7);
    }
    else {
      return;
    }

    let clicked = this.leftButtonDown || tapped;

    //
    // if cursor over new tile, or user is painting currently hovered cell
    //
    if (newTile || (newColor && clicked) ) {

      // save the old color for later before drawing over it
      let ctx = this.canvas.getContext('2d');
      let oldColor = this.getColor(coords);

      // if clicked, then paint data will be sent to chain
      if (newColor && clicked) {
        // oldColor is now the painted color
        // function queues up cell position and color data
        oldColor = this.queueTile(event, app);

        // if mouse was tapped once instead of dragged
        if (tapped) {
	  //
	  // SEND TO GRAFFITI MODULE -- BLOCKCHAIN INVOKED
	  //
          this.mod.sendQueueTransaction(this.queue);
	  //
	  // let UI component manage clearing the queue
	  //
	  this.queue = [];
        }
        //
        // otherwise the queue is sent when mouse is dragged -
        // this is done inside the document.onmouseup event
      }

      // if no click, then don't paint, but draw the preview
      //
      // and restore the true color of the last cell hovered over
      //
      else {
        // draw preview over cnurrently hovered cell
        this.drawTile(coords, color, app);
        // replace previous hovered cell's true color
      }

      // replace previous hovered cell's true color
      if (newTile) {
        this.drawTile(this.lastHover['coords'], this.lastHover['color'], this.app);
      }

      // Finally, set currently hovered tile as lastHover
      this.lastHover = {'coords': coords, 'color' : oldColor }

    }
  }

  fadeColor(hexColor, fadeAmount) {
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
  getTileCoords(canvas, event, cellSize, zoom) {
    let rect   = canvas.getBoundingClientRect();
    let coords = [(event[0] - rect.left) / zoom, (event[1] - rect.top ) / zoom];
    let cell_sz = cellSize * zoom; 
    coords = coords.map(t => Math.floor(t));
    coords = coords.map(t => t - (t % cellSize));
    return coords;
  } 

  transformElement() {
    translate[0] = this.unscaled_translate[0] + this.center[0] / this.scale;
    translate[1] = this.unscaled_translate[1] + this.center[1] / this.scale;
    const x_str = `${translate[0]}px,`;
    const y_str = `${translate[1]}px,`;
    this.canvas.style.webkitTransform = `scale(${this.scale}) translate3d(${x_str}${y_str}0px)`;
  }

  getColor(coords) {
    let color = this.currentTiles[String(coords)];
    if (color) { return color; }
    else { return "#FFFFFF"; }
  }

  queueTile(event, app) {

    let rect = this.canvas.getBoundingClientRect();
    let coords = getTileCoords(this.canvas, [event.clientX, event.clientY], this.cellSize, this.scale);

    coords = coords.map(t => Math.floor(t));
    coords = coords.map(t => t - (t % this.tileSize));
        
    // get color then pre-draw cell
    let color = document.getElementById("favcolor").value;
    
    // preview color is washed out
    let semiColor = this.fadeColor(color, 0.5);
  
    // if color is too white
    if (color[1] == "f" && color[3] == "f" && color[5] == "f") {
      // make the preview darker than intended color
      console.log("too white!")
      semiColor = color + "b0";
    }

    this.drawTile(coords, semiColor, app);
    this.currentTiles[String(coords)] = semiColor;
    this.queue.push([coords, color]);

    return semiColor;
  }


}




module.exports = GraffitiUi;

