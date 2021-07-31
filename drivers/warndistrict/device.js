'use strict';

const { Device } = require('homey');

class warndistrictDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
    async onInit() {
        this.log('Warndistrict has been initialized');

        // TEST: Clear capability to interpret current warnings as new
        await this.removeCapability('last_warnings');
        if (!this.hasCapability('last_warnings'))
        {
            await this.addCapability('last_warnings');
        }


        // if (!this.hasCapability('measure_highest_level'))
        // {
        //     await this.addCapability('measure_highest_level');
        // }
        // if (!this.hasCapability('measure_type'))
        // {
        //     await this.addCapability('measure_type');
        // }
        

        // register eventhandler for device updates
        this.homey.app.events.on("deviceUpdateWarndistrict", this.onDeviceUpdate.bind(this));
    }

    async onDeviceUpdate(data){
      this.log("onDeviceUpdate() Warncell-ID: "+this.getData().id);
      // convert array (filter for ID ans sort descending by level)
      let warningList = await this.convertWarnings(data);
      // check if warnings have changed
      if( await this.getCapabilityValue("last_warnings") != JSON.stringify(warningList) ){

        if (warningList.length == 0){
          // no warnings, clear all capabilities
          try{
            this.log("onDeviceUpdate() - Changed warnings bot no entiries in list - clear capabilities.");
            this.setCapabilityValue("last_warnings", JSON.stringify(warningList)),
            this.setCapabilityValue("measure_highest_level", 0);
            this.setCapabilityValue("measure_type", '');
            this.setCapabilityValue("measure_number_of_warnings", 0);
            // Old warnings existing? Create timeline message about cancel of warnings
            let cancelMessage = this.homey.__("warning.cancelled") +' '+ this.getName();
            this.homey.notifications.createNotification({excerpt: cancelMessage });
          }
          catch (error){
            this.log("Error setting capabilities: " + error.message);
          }
        }
        else{
          // message exists, write to capabilities
          try{
            this.log("onDeviceUpdate() - Changed warnings!");
            // this.log("setCapabilityValue: last_warnings");
            this.setCapabilityValue("last_warnings", JSON.stringify(warningList)),
            // this.log("setCapabilityValue: measure_highest_level:" + warningList[0].level);
            this.setCapabilityValue("measure_highest_level", warningList[0].level);
            // this.log("setCapabilityValue: measure_type:" + warningList[0].event);
            this.setCapabilityValue("measure_type", warningList[0].event);
            // this.log("setCapabilityValue: measure_number_of_warnings:" + warningList.length);
            if (warningList.length > 0){
              this.setCapabilityValue("measure_number_of_warnings", warningList.length);
            }
            else{
              this.setCapabilityValue("measure_number_of_warnings", 0);
            }
          }
          catch (error){
            this.log("Error setting capabilities: " + error.message);
          }
        }
        // Send timeline message for each warning
        let capabilityMessage = '';
        for(let i=0; i < warningList.length; i++ ){
          let message = await this.composeMessage(warningList[i]);
          // this.log("Message");
          // this.log(message);
          this.homey.notifications.createNotification({excerpt: message});
          // concatenate messages for capability
          if (capabilityMessage == ''){
            capabilityMessage = message;
          }
          else
          {
            capabilityMessage = capabilityMessage + " /// " + message;
          }
        } 
        // set complete warning text into capability
        // this.log("setCapabilityValue: measure_warnings:" + capabilityMessage);
        this.setCapabilityValue("measure_warnings", capabilityMessage);
      }
      else
      {
        this.log("No new warnings found for device");
      }
    }

    async composeMessage(warning){
      let message = this.homey.__("warning.warningFor") + " **" + this.getName()+"**";
      message = message + " - **"+warning.headline+"**";
      message = message + " - " + this.homey.__("warning.warnLevel") + ": " + warning.level;
      message = message + " - "+warning.description;
      let from = await this.convertDateToString(new Date(warning.start));                     
      let to = await this.convertDateToString(new Date(warning.end));                     
      message = message + " - " + this.homey.__("warning.warnPeriod") + ": " + from + " " + this.homey.__("warning.warnPeriodTo") + " " + to;
      return message;
    }

    async convertDateToString(dateObj){
      const tz  = this.homey.clock.getTimezone();
      const nowTime = dateObj;
      const now = nowTime.toLocaleString('de-DE', 
          { 
              hour12: false, 
              timeZone: tz,
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
          });
      let date = now.split(", ")[0];
      date = date.split("/")[2] + "-" + date.split("/")[0] + "-" + date.split("/")[1]; 
      let time = now.split(", ")[1];
      
      let result = date + " " + time;
      return result;
    }

    async convertWarnings(data){
      let warnings = data.filter(x => (x[0] == this.getData().id ))[0];
      this.log("warnings");
      this.log(warnings);
      let warningList = warnings[1];
      //this.log("warningList");
      //this.log(warningList);
      warningList.sort((a, b) => b.level - a.level);
      //this.log("warningList sortiert");
      //this.log(warningList);
      //let warningListString = JSON.stringify(warningList);
      //this.log("warningList als String");
      //this.log(warningListString);
      return warningList;
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Warndistrict has been added');

  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Warndistrict settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('Warndistrict was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('Warndistrict has been deleted');
  }

}

module.exports = warndistrictDevice;
