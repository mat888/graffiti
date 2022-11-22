var saito = require('../../lib/saito/saito');
var ModTemplate = require('../../lib/templates/modtemplate');
const GraffitiAppspaceMain = require('./lib/appspace/main');



class Graffiti extends ModTemplate {

  constructor(app) {
    super(app);

    this.app            = app;
    this.name           = "Graffiti";
    this.appname        = "Graffiti";
    this.appPubKey      = "zEC6dxU9P1LFsHpc3BANqaPdRu4njmqbouCqgRQwFa6J"
    this.description    = "Email plugin that allows visual exploration and debugging of the Saito wallet.";
    this.categories     = "Utilities Core";
    this.icon		= "fas fa-code";
    this.canvas         = "UNSET CANVAS";
    this.cellSize       = 10;

    this.description = "A debug configuration dump for Saito";
    this.categories  = "Dev Utilities";

    app.keys.addKey( this.appPubKey , {watched: true});

    //
    // we want full blocks
    //
    app.SPVMODE = 0;

    console.log("end of Graffiti constructor");
      
    return this;
  }

  initializeCanvas(cellSize, cellsWide, cellsTall) {
      document.body.appendChild(document.createElement('canvas'));
      let canvas = document.getElementsByTagName('canvas')[0];
      this.canvas = canvas;
      this.cellSize = cellSize;
      
      canvas.width = cellSize * cellsWide;
      canvas.height = cellSize * cellsTall;
      canvas.style.display = 'block';
      canvas.style.margin  = ' 0 auto';

      this.drawGrid(cellSize, canvas.width, canvas.height);
  }

  drawGrid(size, width, height) {
      let canvas = this.canvas;
      var ctx = canvas.getContext('2d');

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

    
  initializeHTML(app) {
//    app.keys.addKey( this.appPubKey , {watched: true});
    console.log(app.keys);
    this.initializeCanvas(30, 10, 10);
  }

  attachEvents(app, mod) {
      app.keys.addKey( this.appPubKey , {watched: true});
      let mymod = app.modules.returnModule("Graffiti");

      // When canvas is clicked, compose data about what color to draw
      // and what cell on the grid to draw it on.
      // Then send data as a transaction.
      mymod.canvas.onclick = (e) => {

	  // get coordinates of mouse click relative to canvas
	  let rect = mymod.canvas.getBoundingClientRect();
	  let coords = [e.clientX - rect.left,
			e.clientY - rect.top]

	  // transform real numbered coords into top left corner of cell those coords reside in
	  coords = coords.map(t => Math.floor(t));
	  coords = coords.map(t => t - (t % mymod.cellSize));

	  // get color and send data
	  let color = document.getElementById("favcolor").value;
	  let newtx = app.wallet.createUnsignedTransaction(mymod.appPubKey);

	  newtx.msg.module = "Graffiti";
	  newtx.msg.coords = coords;
	  newtx.msg.color = color;

	  newtx = app.wallet.signTransaction(newtx);
	  app.network.propagateTransaction(newtx);
      }

      document.getElementById("my_button").onclick = (e) => {

	  let color = document.getElementById("favcolor").value;
	  
	  let newtx = app.wallet.createUnsignedTransaction();

	  newtx.msg.my_data = color;
	  newtx.msg.module = "Graffiti";

	  newtx = app.wallet.signTransaction(newtx);
	  app.network.propagateTransaction(newtx);
      }
  }
/*
  shouldAffixCallbackToModule(modname, tx) {
      if (modname == this.name) { return 1; }
      return 0;
  };
*/
  // get info and update page in here
  async onConfirmation(blk, tx, conf, app) {
    console.log("in onConf --------");
    console.log(tx.transaction.from[0].add);

    if (app.BROWSER == 0) { return; }

    console.log("and in browser!");

    if (conf == 0) {
	console.log("conf is 0");
	let mymod = app.modules.returnModule("Graffiti")
	let canvas = mymod.canvas;
	let txmsg = tx.returnMessage();	
	console.log("RECEIVED: " + JSON.stringify(txmsg));

	let ctx    = canvas.getContext('2d');
	let coords = txmsg.coords;
	let color  = txmsg.color;

	ctx.fillStyle = color;
	ctx.fillRect(coords[0], coords[1], mymod.cellSize, mymod.cellSize);

    }

  }

/*
  // get info and update page in here
  async onConfirmation(blk, tx, conf, app) {

    if (app.BROWSER == 0) { return; }

//    let mymod = app.modules.returnModule(txmsg.module);
//    if (mymod.browser_active == 0) {return;}

    let mymod = app.modules.returnModule("Graffiti");
    let txmsg = tx.returnMessage();

    if (conf != 0) {return;}
    console.log("confirmations: " + conf);

    let canvas = mymod.canvas
  }

   attachEventsEmail(app, mod) {
     console.log("attaching events");
    }
*/

}


module.exports = Graffiti;
