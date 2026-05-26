sap.ui.define([], function () {
	"use strict";

	return {
		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.submitacefiling");
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

	};
});