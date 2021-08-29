'use strict';

const { Device } = require('homey');
// DWD Service-URL
const dwdUrl = 'https://maps.dwd.de/geoserver/dwd/wfs?service=WFS&request=GetFeature&typeName=dwd:Warnungen_Gemeinden&srsName=EPSG:4326&&outputFormat=application/json&cql_filter=WARNCELLID=';
// EC_II Types => Warning level
const ecii_level = require('./ecii.js');

class warnlocationDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
    async onInit() {
      this.log('Warnlocation has been initialized');

      await this.updateCapabilities();

      // Register bind-references fopr event handler
      this.onDeviceUpdateHandler = this.onDeviceUpdate.bind(this);

      // register eventhandler for device updates
      this.homey.app.events.on("deviceUpdateWarnlocation", this.onDeviceUpdateHandler);
    }

    async updateCapabilities(){
        // Add new capabilities (if not already added)
    }

    async onDeviceUpdate(data){
      this.log("onDeviceUpdate() Warncell-ID: "+this.getData().id);
      let url = dwdUrl + this.getData().id;
      this.homey.app.getUrl(url)
      .then( data => {
        //this.log("getDWDdata() => Reponse: "+data);
        this.parseDWDresponse(data) 
      })
      .catch( (err) => {
         this.log('onDeviceUpdate() => HTTP-Error: ', err.message);
         return;
      });

    }

    async parseDWDresponse(data){
      let json = JSON.parse(data);
      if (! json.features){
        // no valid JSON data
        return;
      }
      let warningList = json.features;
      warningList.sort((a, b) => a.properties.ONSET - b.properties.ONSET);
      if ( await this.getCapabilityValue("last_warnings") != JSON.stringify(warningList) ){
        
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
            this.homey.notifications.createNotification({excerpt: messageCapability });
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
            // Sort by alarm level (not sure which field is the right one)
            //warnings.sort((a, b) => a.start - b.start);
            this.log("onDeviceUpdate() - Changed warnings!");
            // this.log("setCapabilityValue: last_warnings");
            this.setCapabilityValue("last_warnings", JSON.stringify(warningList)),
            // this.log("setCapabilityValue: measure_highest_level:" + warningList[0].level);
            this.setCapabilityValue("measure_highest_level", this.getWarningLevelByECII(warningList[0].properties.EC_II));
            // this.log("setCapabilityValue: measure_type:" + warningList[0].event);
            this.setCapabilityValue("measure_type", warningList[0].properties.EVENT);
            // this.log("setCapabilityValue: measure_number_of_warnings:" + warningList.length);
            if (warningList.length > 0){
              this.setCapabilityValue("measure_number_of_warnings", warningList.length);
            }
            else{
              this.setCapabilityValue("measure_number_of_warnings", 0);
            }

            // Send timeline message for each warning
            warningList.sort((a, b) => this.getWarningLevelByECII(a.properties.EC_II) - this.getWarningLevelByECII(b.properties.EC_II));
            let capabilityMessage = '';
            for(let i=0; i < warningList.length; i++ ){
              let message = await this.composeMessage(warningList[i], true);
              // this.log("Message");
              // this.log(message);
              this.homey.notifications.createNotification({excerpt: message});
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
            // clear unused warning capabilities
            if (warningList.length < 2){
              this.clearWarningCapability(1);
            }
            if (warningList.length < 3){
              this.clearWarningCapability(2);
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
     * @param {*} ecii: EC_II warn event
     * Thsi event id is converted into a warning level 
     */
    getWarningLevelByECII(ecii){
      let ecii_entry = ecii_level.filter(x => (x.ecii == parseInt(ecii)))[0];
      if (ecii_entry && ecii_entry.warninglevel)
      {
        this.log("Warnlevel: "+ecii+" => "+ecii_entry.warninglevel);
        return ecii_entry.warninglevel;
      }
      else{
        return 0;
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
        this.setCapabilityValue('warning_'+idText+'_msgtype', '');
        this.setCapabilityValue('warning_'+idText+'_group', '');
        this.setCapabilityValue('warning_'+idText+'_severity', '');
        this.setCapabilityValue('warning_'+idText+'_type_ecii', 0);
        this.setCapabilityValue('warning_'+idText+'_parametername', '');
        this.setCapabilityValue('warning_'+idText+'_parametervalue', '');
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
        this.setCapabilityValue('warning_'+idText+'_type', warning.properties.EVENT);
        this.setCapabilityValue('warning_'+idText+'_level', this.getWarningLevelByECII(warning.properties.EC_II));
        this.setCapabilityValue('warning_'+idText+'_description', warning.properties.DESCRIPTION.substring(0, Math.min(255,warning.properties.DESCRIPTION.length)));
        let from = await this.convertDateToString(new Date(warning.properties.ONSET));                     
        let to = await this.convertDateToString(new Date(warning.properties.EXPIRES));                     
        this.setCapabilityValue('warning_'+idText+'_period', from +' - '+to);
        this.setCapabilityValue('warning_'+idText+'_msgtype', warning.properties.MSGTYPE);
        this.setCapabilityValue('warning_'+idText+'_group', warning.properties.EC_GROUP);
        this.setCapabilityValue('warning_'+idText+'_severity', warning.properties.SEVERITY);
        this.setCapabilityValue('warning_'+idText+'_type_ecii', parseInt(warning.properties.EC_II) );
        this.setCapabilityValue('warning_'+idText+'_parametername', warning.properties.PARAMETERNAME);
        this.setCapabilityValue('warning_'+idText+'_parametervalue', warning.properties.PARAMETERVALUE);

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
      message = message + " - " + boldParam + warning.properties.HEADLINE + boldParam;
      // message = message + " - " + this.homey.__("warning.warnLevel") + ": " + warning.???;
      message = message + " - "+warning.properties.DESCRIPTION;
      let from = await this.convertDateToString(new Date(warning.properties.ONSET));                     
      let to = await this.convertDateToString(new Date(warning.properties.EXPIRES));                     
      message = message + " - " + this.homey.__("warning.warnPeriod") + ": " + 
                boldParam + from + boldParam +
                " " + this.homey.__("warning.warnPeriodTo") + " " + 
                boldParam + to + boldParam;
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

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Warnlocationt has been added');
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
    this.log('Warnlocation settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('Warnlocation was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.homey.app.events.removeListener("deviceUpdateWarnlocation", this.onDeviceUpdateHandler);
    this.log('Warnlocation has been deleted');
  }
}

module.exports = warnlocationDevice;
