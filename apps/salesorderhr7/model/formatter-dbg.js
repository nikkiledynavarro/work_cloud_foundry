sap.ui.define([], function () {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.salesorder.hr7");
			return sRootPath + "/image/shiperp_logo.png";
		},

		currencyValue: function (sValue) {
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

		formatDeliveryStatus: function (sDeliveryStatus) {
			if (sDeliveryStatus === "C") {
				return "Success";
			}
			if (sDeliveryStatus === "B") {
				return "Warning";
			}
			if (sDeliveryStatus === "A") {
				return "Error";
			}
			if (sDeliveryStatus === "C") {
				return "None";
			}
			return "None";
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
		}
	};

});