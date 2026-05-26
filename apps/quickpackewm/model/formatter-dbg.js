sap.ui.define([], function () {
	"use strict";
	return {
		/**
		 * Rounds the number unit value to 2 digits
		 * @public
		 * @param {string} sValue the number string to be rounded
		 * @returns {string} sValue with 2 digits rounded
		 */
		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.hr7.quickpackewm");
			return sRootPath + "/image/shiperp_logo.png";
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

		statusText: function (text) {
			if (text === "@08@") {
				return "Success";
			} else if (text === "@0C@") {
				return "Warning";
			} else {
				return "Failed";
			}
		},

		statusState: function (state) {
			if (state === "@08@") {
				return "Success";
			} else if (state === "@0C@") {
				return "Warning";
			} else {
				return "Error";
			}
		},
		statusIcon: function (icon) {
			if (icon === "@08@") {
				return "sap-icon://sys-enter-2";
			} else if (icon === "@0C@") {
				return "sap-icon://message-warning";
			} else {
				return "sap-icon://error";
			}
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

		displayEmptyIfZero: function (value) {
			if (value > 0) {
				return value;
			}
			return "";
		},
		displayEmptyIfZeroInt: function (value) {
			if (value > 0) {
				return parseFloat(value).toFixed(3);
			}
			return "";
		},
		formatDateTime: function (sDate) {
			if (sDate) {
				var data = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "MM/dd/yyyy",
					UTC: true
				});
				return data.format(new Date(sDate));
			} else {
				return sDate;
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
		formatdecimalplaces: function (oData) {
			if (Number.isInteger(parseFloat(oData))) {
				return parseFloat(oData);
			} else {
				return parseFloat(oData).toFixed(3);
			}

		},
		isSelected: function (sel) {
			if (sel && sel.toUpperCase() === "X") {
				return true;
			} else {
				return false;
			}
		}
	};

});