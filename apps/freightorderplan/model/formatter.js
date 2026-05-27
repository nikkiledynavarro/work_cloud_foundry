sap.ui.define([], function () {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.hr7.tuv");
			return sRootPath + "/image/shiperp_logo.png";
		},

		numberUnit: function (sValue) {
			if (!sValue) {
				return "";
			}
			return parseFloat(sValue).toFixed(2);
		},

		removeLeadingZero: function (sString) {
			try {
				// if is char degit
				if (!!sString.trim() && sString * 0 === 0) {
					return parseInt(sString, 10);
				}

				return sString;
			} catch (exc) {
				return "";
			}
		},

		getStateForParentNode: function (oData) {
			if (oData && oData.Children.length > 0) {
				return "Success";
			}
			return "None";
		},

		trafficLight: function (sStatus) {
			if (sStatus === "@01\\QStatus Set@") {
				return "sap-icon://accept";
			} else if (sStatus === "@BZ\\QStatus Not Set@" || sStatus === "@BZ\\QAssigned object was not changed@") {
				return "sap-icon://to-be-reviewed";
			} else {
				return "";
			}
		},

		trafficLightState: function (sStatus) {
			if (sStatus === "@01\\QStatus Set@") {
				return "Success";
			} else if (sStatus === "@BZ\\QStatus Not Set@" || sStatus === "@BZ\\QAssigned object was not changed@") {
				return "None";
			} else {
				return "Error";
			}
		},

		trafficLightTooltip: function (sStatus) {
			if (sStatus === "@01\\QStatus Set@") {
				return "Status set";
			} else if (sStatus === "@BZ\\QStatus Not Set@") {
				return "Status not set";
			} else if (sStatus === "@BZ\\QAssigned object was not changed@") {
				return "Assigned object was not changed";
			} else {
				return "";
			}
		},

		validateDocNo: function (sValue) {
			if (sValue && sValue !== null) {
				return sValue.replace(/^0+/, "");
			} else {
				return "";
			}
		},

		validateLoadIcon: function (sStatus) {
			if (sStatus && sStatus !== null) {
				if (sStatus === "@BZ\\QLoading Not Relevant@") {
					return "sap-icon://border";
				} else if (sStatus === "@0A\\QNot Loaded@") {
					return "sap-icon://up";
				} else {
					return "";
				}
			}
		},

		validateLoadState: function (sStatus) {
			if (sStatus && sStatus !== null) {
				if (sStatus === "@BZ\\QLoading Not Relevant@") {
					return "Success";
				} else if (sStatus === "@0A\\QNot Loaded@") {
					return "Warning";
				} else {
					return "Error";
				}
			}
		},

		validateLoadTooltip: function (sStatus) {
			if (sStatus && sStatus !== null) {
				if (sStatus === "@BZ\\QLoading Not Relevant@") {
					return "Loading Not Relevant";
				} else if (sStatus === "@0A\\QNot Loaded@") {
					return "Not Loaded";
				} else {
					return "";
				}
			}
		},

		validateGI: function (sStatus) {
			if (sStatus && sStatus !== null) {
				if (sStatus === "@0A\\QGoods Issue Not Posted@") {
					return "sap-icon://circle-task";
				} else {
					return "";
				}
			}

		},

		validateGIState: function (sStatus) {
			if (sStatus && sStatus !== null) {
				if (sStatus === "@0A\\QGoods Issue Not Posted@") {
					return "Error";
				} else {
					return "";
				}
			}
		},

		validateGITooltip: function (sStatus) {
			if (sStatus && sStatus !== null) {
				if (sStatus === "@0A\\QGoods Issue Not Posted@") {
					return "Goods Issue Not Posted";
				} else {
					return "";
				}
			}
		},

		formatAmountQty: function (fAmountQty) {
			if (fAmountQty) {
				return parseFloat(fAmountQty).toFixed(2).replace(/\.0+$/, "");
			}
			return fAmountQty;
		},

		formatDocNoItemCategoryIcon: function (itemCat) {
			var sIcon = "sap-icon://car-rental";

			if (itemCat === "AVR") {
				sIcon = "sap-icon://vehicle-repair";
			}
			if (itemCat === "DLV") {
				sIcon = "sap-icon://product";
			}
			if (itemCat === "PKG") {
				sIcon = "sap-icon://supplier";
			}
			return sIcon;
		},

		formatState: function (itemCat) {
			// var sState = "None";
			var sState = "Success";
			if (itemCat === "AVR") {
				sState = "Error";
			}
			if (itemCat === "FOB") {
				sState = "Success";
			}
			if (itemCat === "PKG") {
				sState = "Warning";
			}
			return sState;
		},

		formatDocNoItemCategoryState: function (itemCat) {
			// var sState = "None";
			var sState = "Success";
			if (itemCat === "AVR") {
				sState = "Error";
			}
			if (itemCat === "DLV") {
				sState = "Success";
			}
			if (itemCat === "PKG") {
				sState = "Warning";
			}
			return sState;
		},

		_formatDateObject: function (sDate) {
			var year = sDate.substring(0, 4);
			var month = sDate.substring(4, 6);
			var day = sDate.substring(6, 8);

			return sDate = year + '-' + month + '-' + day;
		},

		validateAssignObjectIcon: function (sStatus) {
			if (sStatus === "@BZ\\QAssigned object was not changed@") {
				return "sap-icon://rhombus-milestone-2";
			} else {
				return "";
			}
		},

		validateAssignObjectTooltip: function (sStatus) {
			if (sStatus === "@BZ\\QAssigned object was not changed@") {
				return "Assigned object was not changed";
			} else {
				return "";
			}
		},

		validateIcon: function (sStatus) {
			if (sStatus === "@BZ\\QStatus Not Set@") {
				return "sap-icon://rhombus-milestone-2";
			} else if (sStatus === "@01\\QStatus Set@") {
				return "sap-icon://accept";
			} else {
				return "";
			}
		},

		validateColor: function (sStatus) {
			if (sStatus === "@01\\QStatus Set@") {
				return "Success";
			} else {
				return "None";
			}
		},

		validateTooltip: function (sStatus) {
			if (sStatus === "@BZ\\QStatus Not Set@") {
				return "Status Not Set";
			} else if (sStatus === "@01\\QStatus Set@") {
				return "Status Set";
			} else {
				return "";
			}
		},
		formatDate: function (date) {
			var year = date.getFullYear();
			var month = (date.getMonth() + 1).toString().padStart(2, '0');
			var day = date.getDate().toString().padStart(2, '0');
			return year + '-' + month + '-' + day;
		},

		validateVehicleStatusColor: function (sStatus) {
			if (sStatus === "@01\\QStatus Set@") {
				return "Success";
			} else if (sStatus === "@BZ\\QStatus Not Set@") {
				return "Warning";
			} else {
				return "None";
			}
		},

		validateVehicleIcon: function (sStatus) {
			if (sStatus === "@01\\QStatus Set@") {
				return "sap-icon://border";
			} else if (sStatus === "@BZ\\QStatus Not Set@") {
				return "sap-icon://up";
			} else {
				return "";
			}
		},

		formatDateTime: function (sDate) {
			if (sDate) {
				var data = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "MM/dd/yyyy"
				});
				return data.format(new Date(sDate));
			} else {
				return sDate;
			}
		},

		formatTime: function (milliseconds) {
			if (milliseconds) {
				var date = new Date(milliseconds.ms);
				var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({
					pattern: "HH:mm:ss"
				});
				return timeFormat.format(date);
			} else {
				return milliseconds;
			}
		},

		//convert time UTC
		_convertTimeUTC: function () {
			var sHrs = new Date().getUTCHours().toString().padStart(2, "0");
			var sMinute = new Date().getUTCMinutes().toString().padStart(2, "0");
			var sSecond = new Date().getUTCSeconds().toString().padStart(2, "0");
			return sHrs + ":" + sMinute + ":" + sSecond;
		},

		//convert date UTC
		_convertDateUTC: function () {
			var sDay = new Date().getUTCDate().toString().padStart(2, "0");
			var sPlus = new Date().getUTCMonth() + 1;
			var sMonth = sPlus.toString().padStart(2, "0");
			var sYear = new Date().getUTCFullYear();
			return sYear + "-" + sMonth + "-" + sDay;
		},
			//end
	};

});