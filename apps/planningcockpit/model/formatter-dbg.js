sap.ui.define([], function () {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.planningcockpit");
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

		}
	};

});