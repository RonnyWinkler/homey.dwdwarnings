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
    
    let hasWarnings = this.homey.flow.getConditionCard('has_warnings');
    hasWarnings.registerRunListener(async (args, state) =>
    {
        return args.device.getCapabilityValue('has_warnings'); // true or false
    });
  }

  async onPair(session) {
    this.log("onPair()");

    session.setHandler("list_devices", async () => {
      return await this.onPairListDevices(session);
    });

    session.setHandler("warncellname", async (name) => {
      return await this.onInputWarncellname(name);
    });
  }

  /**
   * Selects the number of entires fitting the name set in the pair dialog
   * @param {*} name Name (part) of city/district
   * @returns Number of found entries
   */
  async onInputWarncellname(name){
    this.log("Event warncellname, Name: "+name);
    if (name.length < 3){
      this.warncellname = '';
      return '---';
    }
    else{
      this.warncellname = name;
      let filteredDevices = wanrcellids.filter(x => (x.name.indexOf(name) != -1));    
      this.log("Found: "+filteredDevices.length);
      return filteredDevices.length;
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
    let filteredDevices = wanrcellids.filter(x => ( x.name.indexOf(this.warncellname) != -1 ) );
    this.log("Found: "+filteredDevices.length);
    return filteredDevices;
  }

}

module.exports = warndistrictDriver;