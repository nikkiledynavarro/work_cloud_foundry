sap.ui.define([
	"sap/ui/core/ValueState"
], function (ValueState) {
	"use strict";

	return {

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

		formatJavascriptTime: function (sTime) {
			if (!sTime || sTime.length !== 6 || sTime === "000000") {
				return "";
			} else {
				var sHour = sTime.substring(0, 2);
				var sMinute = sTime.substring(2, 4);
				var sSecond = sTime.substring(4, 6);
				return sHour + ":" + sMinute + ":" + sSecond;
			}
		}

	};

});