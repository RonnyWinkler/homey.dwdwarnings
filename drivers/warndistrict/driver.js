'use strict';

const { Driver } = require('homey');
const wanrcellids = require('./warncellid');

class warndistrictDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('Warndistrict has been initialized');
    this.warncellname = '';
  }

  async onPair(session) {
    this.log("onPair()");

    session.setHandler("list_devices", async () => {
      return await this.onPairListDevices(session);
    });

    session.setHandler("warncellname", async (name) => {
      return await this.onInputWarncellname(name);
    });

    session.setHandler("warncellnameGetList", async (name) => {
      return await this.onInputWarncellnameGetList(name);
    });
  }

  /**
   * Selects the number of entires fitting the name set in the pair dialog
   * @param {*} name Name (part) of city/district
   * @returns Number of found entries
   */
  async onInputWarncellname(name){
    this.log("Event warncellname, Name: "+name);
    if (name == null){
      this.warncellname = '';
      return 0;
    }
    else{
      this.warncellname = name;
      let filteredDevices = wanrcellids.filter(x => (x.name.toLowerCase().indexOf(name.toLowerCase()) != -1));    
      this.log("Found: "+filteredDevices.length);
      return filteredDevices.length;
    }
  }

  async onInputWarncellnameGetList(name){
    this.log("Event warncellnameGetList, Name: "+name);
    if (name == null){
      this.warncellname = '';
      return [];
    }
    else{
      this.warncellname = name;
      let filteredDevices = wanrcellids.filter(x => (x.name.toLowerCase().indexOf(name.toLowerCase()) != -1));
      this.log("Found: "+filteredDevices.length);
      return filteredDevices;
    }
  }


  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices(session) {
    this.log("onPairListDevices()" );
    this.log("Name: " +this.warncellname);
    if (this.warncellname == '')
    {
      return [];
    }
    let filteredDevices = wanrcellids.filter(x => ( x.name.toLowerCase().indexOf(this.warncellname.toLowerCase()) != -1 ) );
    this.log("Found: "+filteredDevices.length);
    return filteredDevices;
  }

}

module.exports = warndistrictDriver;