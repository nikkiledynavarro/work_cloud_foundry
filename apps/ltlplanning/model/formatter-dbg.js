sap.ui.define([], function () {
	"use strict";

	return {
		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.hr7.ltlplanning");
			return sRootPath + "/image/shiperp_logo.png";
		},
		formatDateString: function (sDate) {
			if (sDate) {
				var data = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "MM/dd/yyyy"
				});
				return data.format(new Date(sDate));
			} else {
				return sDate;
			}
		},

		formatTime: function (Milseconds) {
			if (Milseconds) {
				var format = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "PTHH'H'mm'M'ss'S'",
					UTC: true
				});
				for (var key in Milseconds) {
					if (Milseconds.hasOwnProperty(key)) {
						if (key === "Putime" || key === "Dockopen" || key === "Dockclos") {
							if (typeof Milseconds[key] === "object") {
								Milseconds[key] = format.format(new Date(Milseconds[key].ms));
							}
						}
					}
				}
				return Milseconds;
			} else {
				return Milseconds;
			}
		},

		Convertmilliseconds: function (oValue) {
			if (oValue) {
				var format = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "PTHH'H'mm'M'ss'S'",
					UTC: true
				});
				for (var key in oValue) {
					if (oValue.hasOwnProperty(key)) {
						if (key === "Putime" || key === "Dockopen" || key === "Dockclos") {
							if (oValue[key] === null) {
								oValue[key] = "PT00H00M00S";
							}
							if (typeof oValue[key] === "object") {
								oValue[key] = format.format(oValue[key]);
							}
						}
					}
				}
				return oValue;
			}
			return oValue;
		},

	};
});