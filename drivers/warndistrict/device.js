'use strict';

const { Device } = require('homey');
// state URL for warnmap
const state_url = require('../../state_url.js');
// country URL
const countryUrl = 'https://www.dwd.de/DWD/warnungen/warnapp_gemeinden/json/warnungen_gemeinde_map_de.png';

class warndistrictDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
    async onInit() {
      this.log('Warndistrict has been initialized');

      // TEST: Clear capability to interpret current warnings as new
      // await this.removeCapability('last_warnings');
      // if (!this.hasCapability('last_warnings'))
      // {
      //     await this.addCapability('last_warnings');
      // }

      await this.updateCapabilities();

      // Register bind-references fopr event handler
      this.onDeviceUpdateHandler = this.onDeviceUpdate.bind(this);

      // register eventhandler for device updates
      this.homey.app.events.on("deviceUpdateWarndistrict", this.onDeviceUpdateHandler);

      // Register Image
      this.registerImage();
    }

    async updateCapabilities(){
        // v.0.0.8: Add new capabilities (if not already added)
        if (!this.hasCapability('alarm_warnings'))
        {
            await this.addCapability('alarm_warnings');
        }
        if (!this.hasCapability('warning_01_type'))
        {
            await this.addCapability('warning_01_type');
        }
        if (!this.hasCapability('warning_01_level'))
        {
            await this.addCapability('warning_01_level');
        }
        if (!this.hasCapability('warning_01_period'))
        {
            await this.addCapability('warning_01_period');
        }
        if (!this.hasCapability('warning_01_description'))
        {
            await this.addCapability('warning_01_description');
        }
        if (!this.hasCapability('warning_02_type'))
        {
            await this.addCapability('warning_02_type');
        }
        if (!this.hasCapability('warning_02_level'))
        {
            await this.addCapability('warning_02_level');
        }
        if (!this.hasCapability('warning_02_period'))
        {
            await this.addCapability('warning_02_period');
        }
        if (!this.hasCapability('warning_02_description'))
        {
            await this.addCapability('warning_02_description');
        }
        if (!this.hasCapability('warning_03_type'))
        {
            await this.addCapability('warning_03_type');
        }
        if (!this.hasCapability('warning_03_level'))
        {
            await this.addCapability('warning_03_level');
        }
        if (!this.hasCapability('warning_03_period'))
        {
            await this.addCapability('warning_03_period');
        }
        if (!this.hasCapability('warning_03_description'))
        {
            await this.addCapability('warning_03_description');
        }
    }

    async registerImage(){
      // Image for WarnMap
      let imageUrl = await this.getImageURL();
      const mapImage = await this.homey.images.createImage();
      mapImage.setUrl(imageUrl);
      this.setCameraImage('warnmap', this.homey.__('warnmap.titleState'), mapImage);
      // Image for Germany WarnMap
      const mapImageGermany = await this.homey.images.createImage();
      mapImageGermany.setUrl(countryUrl);
      this.setCameraImage('warnmapGermany', this.homey.__('warnmap.titleCountry'), mapImageGermany);
    }

    async getImageURL(){
      let state = this.getData().id.toString().substring(1, 3);
      //this.log("State: "+state);
      let url = state_url.filter(x => (x.state == state))[0].url;
      //this.log("URL: "+url);
      return url;
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
            let messageCapability = this.homey.__("warning.cancelled") +' **'+ this.getName() + '**';
            this.homey.notifications.createNotification({excerpt: messageCapability }).catch(error => {this.error('Error sending notification: '+error.message)});
            // set complete warning text into capability
            messageCapability = this.homey.__("warning.cancelled") +' '+ this.getName();
            // this.log("setCapabilityValue: measure_warnings:" + capabilityMessage);
            this.setCapabilityValue("measure_warnings", messageCapability);
            // alarm_warnings
            this.setCapabilityValue("alarm_warnings", false);
            // clear single warning capabilities
            this.clearWarningCapability(0);
            this.clearWarningCapability(1);
            this.clearWarningCapability(2);
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

            // Send timeline message for each warning
            warningList.sort((a, b) => a.start - b.start);
            let capabilityMessage = '';
            for(let i=0; i < warningList.length; i++ ){
              let message = await this.composeMessage(warningList[i], true);
              // this.log("Message");
              // this.log(message);
              this.homey.notifications.createNotification({excerpt: message}).catch(error => {this.error('Error sending notification: '+error.message)});
              // concatenate messages for capability (without bold text)
              let messageCapability = await this.composeMessage(warningList[i], false);
              if (capabilityMessage == ''){
                capabilityMessage = messageCapability;
              }
              else
              {
                capabilityMessage = capabilityMessage + " + + + " + messageCapability;
              }
              // set warning capabilities 01..03 
              await this.setWarningCapability(i, warningList[i]);
            } 
            // set complete warning text into capability
            // this.log("setCapabilityValue: measure_warnings:" + capabilityMessage);
            this.setCapabilityValue("measure_warnings", capabilityMessage);
            // alarm_warnings
            if (warningList.length > 0){
              this.setCapabilityValue("alarm_warnings", true);
            }
            else{
              this.setCapabilityValue("alarm_warnings", false);
            }
          }
          catch (error){
            this.log("Error setting capabilities: " + error.message);
          }
        }
      }
      else
      {
        this.log("No new warnings found for device");
      }
    }

    /**
     * 
     * @param {*} id:  ID of warning capability (0 .. 2)
     * This ID is converted into 01 .. 03 for capability name
     */
    async clearWarningCapability(id = 0){
      if (id < 0 || id > 2){
        return;
      }
      id = id + 1;
      let idText = id.toString();
      if (idText.length < 2){
        idText = '0' + idText;
      }
      try{
        this.log("clearWarningCapability() => capability: " + 'warning_'+idText+'_*');
        this.setCapabilityValue('warning_'+idText+'_type', '');
        this.setCapabilityValue('warning_'+idText+'_level', 0);
        this.setCapabilityValue('warning_'+idText+'_period', '');
        this.setCapabilityValue('warning_'+idText+'_description', '');
      }
      catch (error){
        this.log("Error setting capabilities: " + error.message);
      }
    }

    /**
     * 
     * @param {*} id:  ID of warning capability (0 .. 2)
     * This ID is converted into 01 .. 03 for capability name
     */
     async setWarningCapability(id = 0, warning){
      if (id < 0 || id > 2){
        return;
      }
      id = id + 1;
      let idText = id.toString();
      if (idText.length < 2){
        idText = '0' + idText;
      }
      try{
        this.log("setWarningCapability() => capability: " + 'warning_'+idText+'_*');
        this.setCapabilityValue('warning_'+idText+'_type', warning.event);
        this.setCapabilityValue('warning_'+idText+'_level', warning.level);
        this.setCapabilityValue('warning_'+idText+'_description', warning.description.substring(0, Math.min(255,warning.description.length)));
        let from = await this.convertDateToString(new Date(warning.start));                     
        let to = await this.convertDateToString(new Date(warning.end));                     
        this.setCapabilityValue('warning_'+idText+'_period', from +' - '+to);
      }
      catch (error){
        this.log("Error setting capabilities: " + error.message);
      }

    }

    async composeMessage(warning, boldText = true){
      let boldParam = '';
      if (boldText){
        boldParam = '**';
      }
      let message = this.homey.__("warning.warningFor") + " " + boldParam + this.getName() + boldParam;
      message = message + " - " + boldParam + warning.headline + boldParam;
      message = message + " - " + this.homey.__("warning.warnLevel") + ": " + warning.level;
      message = message + " - "+warning.description;
      let from = await this.convertDateToString(new Date(warning.start));                     
      let to = await this.convertDateToString(new Date(warning.end));                     
      message = message + " - " + this.homey.__("warning.warnPeriod") + ": " + 
                boldParam + from + boldParam +
                " " + this.homey.__("warning.warnPeriodTo") + " " + 
                boldParam + to + boldParam;
      return message;
    }

    async convertDateToString(dateObj){
      const tz  = this.homey.clock.getTimezone();
      const nowTime = dateObj;
      const now = nowTime.toLocaleString('en-US', 
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
      let warnings = [];
      warnings = await this.filterWarnings(data);
      this.log("convertWarnings() => warnings");
      this.log(warnings);
      if (warnings.length > 0){
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
      else {
        return [];
      }
    }

    async filterWarnings(data){
      let warnings =  await data.filter(x => (x[0] == this.getData().id ))[0];
      //this.log("filterWarnings()");
      //this.log(warnings);
      if (!warnings){
        warnings = [];
        return warnings;
      }
      else{
        return warnings;
      }
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
    this.homey.app.events.removeListener("deviceUpdateWarndistrict", this.onDeviceUpdateHandler);
    this.log('Warndistrict has been deleted');
  }

}

module.exports = warndistrictDevice;
