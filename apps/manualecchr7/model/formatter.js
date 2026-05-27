sap.ui.define([], function () {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.manualecc.hr7");
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
		displayEmptyIfZero: function (value) {
			if (value > 0) {
				return value;
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

		formatmessage: function (oType) {
			if (oType === "Information") {
				return 'sap-icon://message-information';
			}
			if (oType === "Error") {
				return 'sap-icon://error';
			}
			if (oType === "Warning") {
				return 'sap-icon://alert';
			}
			if (oType === "Success") {
				return 'sap-icon://sys-enter-2';
			}

		},
		trafficIconMessages: function (icon) {
			// if (icon === "Information") {
			// 	return "Information";
			// }
			if (icon === "Error") {
				return 'Error';
			}
			if (icon === "Warning") {
				return 'Warning';
			}
			if (icon === "Success") {
				return 'Success';
			}

		}
	};

});