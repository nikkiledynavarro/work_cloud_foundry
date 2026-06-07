sap.ui.define([], function () {
	"use strict";

	return {
		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.hr7.requestforpickup");
			return sRootPath + "/image/shiperp_logo.png";
		},

		formatTime: function (milliseconds) {
			if (milliseconds) {
				var date = new Date(milliseconds.ms);
				var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({
					pattern: "HH:mm:ss",
					UTC: true
				});
				return timeFormat.format(date);
			} else {
				return milliseconds;
			}
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
		}
	};
});