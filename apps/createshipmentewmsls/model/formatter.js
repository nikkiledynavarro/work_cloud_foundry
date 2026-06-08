sap.ui.define([], function () {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.sls.shipewmsls");
			return sRootPath + "/image/shiperp_logo.png";
		},

		formatJavascriptTime: function (duration) {
			var seconds = parseInt((duration / 1000) % 60, 10),
				minutes = parseInt((duration / (1000 * 60)) % 60, 10),
				hours = parseInt((duration / (1000 * 60 * 60)) % 24, 10);

			hours = (hours < 10) ? "0" + hours : hours;
			minutes = (minutes < 10) ? "0" + minutes : minutes;
			seconds = (seconds < 10) ? "0" + seconds : seconds;

			return hours + ":" + minutes + ":" + seconds;
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

		enabledHu: function (item, hu) {
			var enable;
			if (hu !== "") {
				enable = false;
			}
			if (item) {
				if (item.results.length > 0) {
					enable = true;
				} else {
					enable = false;
				}
			} else {
				enable = true;
			}
			return enable;
		},

		displayAndRemoveLeadingZero: function (sHuNo, sItemValue) {
			var sString = sHuNo;
			if (sItemValue) {
				sString = sItemValue;
			}
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

		formatDateString: function (sDateString) {
			//To be same with ABAP datum data type, sDateString should have format YYYYMMDD
			if (!sDateString || sDateString.length !== 8 || sDateString === "00000000") {
				return "";
			} else {
				var sYear = sDateString.substring(0, 4);
				var sMonth = sDateString.substring(4, 6);
				var sDate = sDateString.substring(6, 8);
				return sMonth + "/" + sDate + "/" + sYear;
			}
		},

		formatBillingHeader: function (sBillingOption, sText1, sText2, sText3) {
			var sText = sText1;

			if (sBillingOption === "PPAID" || sBillingOption === "CONS") {
				return sText;
			}
			sText = sText + " - " + sText2 + " - " + sText3;
			return sText;

		},
		formatPackageLevelIcon: function (level) {
			var sIcon = "sap-icon://car-rental";

			if (level === "0" || level === 0) {
				sIcon = "sap-icon://vehicle-repair";

			}
			if (level === "1" || level === 1) {
				sIcon = "sap-icon://product";
			}
			if (level === "2" || level === 2) {
				sIcon = "sap-icon://supplier";

			}
			return sIcon;

		},
		formatPackageLevelState: function (level) {
			var sState = "None";
			if (level === "AVR") {

				sState = "Error";
			}
			if (level === "PRD") {
				sState = "Success";
			}
			if (level === "PKG") {
				sState = "Warning";
			}
			return sState;

		},
		trafficToopTipDG: function (icon) {
			if (icon === "@0A@") {
				return 'Hazardous materials have not been maintained';
			}
			if (icon === "@09@") {
				return '';
			}
			if (icon === "@08@") {
				return 'All Hazardous Material has been maintained';
			}
			if (icon === "@EB@") {
				return '';
			}
			if (icon === "") {
				return '';
			}

		},
		trafficDisplayIcon: function (icon) {
			if (icon === "@0A@") {
				return 'sap-icon://circle-task-2';
			}
			if (icon === "@09@") {
				return 'sap-icon://circle-task-2';
			}
			if (icon === "@08@") {
				return 'sap-icon://circle-task-2';
			}
			if (icon === "@EB@") {
				return '';
			}
			if (icon === "") {
				return '';
			}

		},
		displayEmptyIfZero: function (value) {
			if (value > 0) {
				return value;
			}
			return "";
		},
		displayEmptyIfZeroInt: function (value) {
			if (value > 0) {
				return parseInt(value, 10);
			}
			return "";
		},
		isEditableFUItem: function (tracNo, useScale) {
			var isEditable = false;
			if (tracNo !== "" && (useScale === "3" || useScale === "0003")) {
				isEditable = true;
			}
			return isEditable;

		},

		trafficIconDG: function (icon) {
			if (icon === "@0A@") {
				return 'Error';
			}
			if (icon === "@09@") {
				return 'Warning';
			}
			if (icon === "@08@") {
				return 'Success';
			}
			if (icon === "@EB@") {
				return 'None';
			}

		},

		trafficIcon: function (icon) {
			if (icon === "@5D@") {
				return 'sap-icon://project-definition-triangle-2';
			}
			if (icon === "@5B@") {
				return 'sap-icon://color-fill';
			}
			if (icon === "@5C@") {
				return 'sap-icon://circle-task-2';
			}
		},

		colorIcon: function (color) {
			if (color === "@5D@") {
				return 'Warning';
			}
			if (color === "@5B@") {
				return 'Success';
			}
			if (color === "@5C@") {
				return 'Error';
			}
		},

		convertDateString: function (sDate) {
			if (sDate) {
				var day = String(sDate.getDate()).padStart(2, "0");
				var month = String(sDate.getMonth() + 1).padStart(2, "0");
				var year = sDate.getFullYear();
				var formattedDay = month + "/" + day + "/" + year;
				return formattedDay;
			} else {
				return "";
			}
		},
		formatProcessed: function (sProcessed) {
			switch (sProcessed) {
			case "FullyProcessed ":
				return "Success";
			case "Unprocessed ":
				return "Error";
			default:
				return sProcessed;
			}
		},
		formatStatusText: function (sStatus) {
			if (sStatus === "inprogress") {
				return "";
			} else if (sStatus === "done") {
				return "";
			} else {
				return sStatus;
			}
		}
	};

});