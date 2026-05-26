sap.ui.define([], function () {
	"use strict";

	return {
		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.hr7.carrierperformancereportewm");
			return sRootPath + "/image/shiperp_logo.png";
		},

		_formatDateObject: function (sDate) {
			var year = sDate.substring(0, 4);
			var month = sDate.substring(4, 6);
			var day = sDate.substring(6, 8);

			return sDate = year + '-' + month + '-' + day;
		},

		formatDate: function (date) {
			var year = date.getFullYear();
			var month = (date.getMonth() + 1).toString().padStart(2, '0');
			var day = date.getDate().toString().padStart(2, '0');
			return year + '-' + month + '-' + day;
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
	};
});