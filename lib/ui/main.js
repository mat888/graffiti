const GraffitiUiTemplate = require('./main.template');

class GraffitiUi {

  constructor(app, mod, container="") {
    this.app = app;
    this.mod = mod;
    this.container = container;
  }

  render() {

    if (document.querySelector(".graffiti-ui-container")) {
      this.app.browser.replaceElementBySelector(".graffiti-ui-container");
    } else {
      this.app.browser.addElementBySelector(".graffiti-ui-container");
    }

    this.attachEvents();

  }

  attachEvents() {

  }

}


module.exports = GraffitiUi;

